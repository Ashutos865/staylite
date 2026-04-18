const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const Property = require('../models/Property');
const Room = require('../models/Room');
const User = require('../models/User'); 
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// ==========================================
// 1. CREATE A NEW HOTEL & ITS MANAGER
// ==========================================
// POST /api/properties/create
router.post('/create', verifyToken, requireRole('PROPERTY_OWNER'), async (req, res) => {
  try {
    const ownerId = req.user.userId; 
    
    const { 
      name, address, contactNumber,
      managerName, managerEmail, managerPassword 
    } = req.body;

    // --- VALIDATION CHECKS ---
    if (!name || !address) return res.status(400).json({ message: 'Hotel name and address are required.' });
    if (!managerName || !managerEmail || !managerPassword) return res.status(400).json({ message: 'Manager name, email, and password are required.' });
    if (managerPassword.length < 6) return res.status(400).json({ message: 'Manager password must be at least 6 characters long.' });

    const existingUser = await User.findOne({ email: managerEmail });
    if (existingUser) return res.status(400).json({ message: 'An account with this manager email already exists.' });

    // --- SAAS SUBSCRIPTION CHECK ---
    const owner = await User.findById(ownerId);
    const currentHotelCount = await Property.countDocuments({ owner: ownerId });

    if (currentHotelCount >= owner.maxHotelsAllowed) {
      return res.status(403).json({ 
        message: `Subscription Limit Reached! You are only allowed to manage ${owner.maxHotelsAllowed} hotel(s).` 
      });
    }

    // --- CREATE PROPERTY ---
    const newProperty = new Property({ name, address, contactNumber, owner: ownerId });
    await newProperty.save();

    // --- CREATE MANAGER ---
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(managerPassword, salt);

    const newManager = new User({
      name: managerName,
      email: managerEmail,
      password: hashedPassword,
      role: 'HOTEL_MANAGER',
      assignedProperty: newProperty._id, 
      createdBy: ownerId 
    });
    await newManager.save();

    res.status(201).json({
      message: 'Hotel and Manager successfully created!',
      property: newProperty,
      manager: { id: newManager._id, name: newManager.name, email: newManager.email }
    });

  } catch (error) {
    console.error('Error creating hotel & manager:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 2. UPDATE EXISTING HOTEL & MANAGER DETAILS
// ==========================================
// PUT /api/properties/:propertyId
router.put('/:propertyId', verifyToken, requireRole('PROPERTY_OWNER'), async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { name, address, contactNumber, managerEmail, managerPassword } = req.body;
    
    // 1. Update the Property Details (Ensuring this owner actually owns it)
    const property = await Property.findOneAndUpdate(
      { _id: propertyId, owner: req.user.userId },
      { name, address, contactNumber },
      { returnDocument: 'after' } // ✅ Fixed Mongoose Deprecation Warning here
    );

    if (!property) return res.status(404).json({ message: 'Property not found or unauthorized.' });

    // 2. Find and Update the Manager's Credentials
    const manager = await User.findOne({ assignedProperty: property._id, role: 'HOTEL_MANAGER' });
    
    if (manager) {
      let isManagerUpdated = false;

      // Update Email if changed
      if (managerEmail && managerEmail !== manager.email) {
        const emailExists = await User.findOne({ email: managerEmail });
        if (emailExists) return res.status(400).json({ message: 'That manager email is already taken by another user.' });
        
        manager.email = managerEmail;
        isManagerUpdated = true;
      }
      
      // Update Password if a new one was typed
      if (managerPassword && managerPassword.length >= 6) {
        const salt = await bcrypt.genSalt(10);
        manager.password = await bcrypt.hash(managerPassword, salt);
        isManagerUpdated = true;
      }

      if (isManagerUpdated) await manager.save();
    }

    res.status(200).json({ message: 'Updated Successfully', property });

  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 3. GET OWNER'S HOTELS (With Manager Attached)
// ==========================================
// GET /api/properties/my-hotels
router.get('/my-hotels', verifyToken, requireRole('PROPERTY_OWNER'), async (req, res) => {
  try {
    // .lean() converts Mongoose docs to plain JS objects so we can attach extra data
    const properties = await Property.find({ owner: req.user.userId }).sort({ createdAt: -1 }).lean();
    
    // Attach manager details to each property payload
    const propertyListWithManagers = await Promise.all(properties.map(async (hotel) => {
      const manager = await User.findOne({ assignedProperty: hotel._id, role: 'HOTEL_MANAGER' }).select('email name');
      return { ...hotel, managerDetails: manager };
    }));

    res.status(200).json(propertyListWithManagers);
  } catch (error) {
    console.error('Error fetching hotels:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 4. ADD A ROOM TO A HOTEL
// ==========================================
// POST /api/properties/:propertyId/rooms
router.post('/:propertyId/rooms', verifyToken, requireRole('PROPERTY_OWNER'), async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { roomNumber, category, capacity, basePrice } = req.body;

    const property = await Property.findOne({ _id: propertyId, owner: req.user.userId });
    if (!property) return res.status(403).json({ message: 'Security Alert: You do not own this hotel.' });

    const existingRoom = await Room.findOne({ property: propertyId, roomNumber });
    if (existingRoom) return res.status(400).json({ message: `Room ${roomNumber} already exists in this hotel.` });

    const newRoom = new Room({
      property: propertyId,
      roomNumber,
      category, 
      capacity: capacity || 2,
      basePrice: basePrice || 1000
    });

    await newRoom.save();

    res.status(201).json({
      message: `Room ${roomNumber} (${category}) successfully added to ${property.name}!`,
      room: newRoom
    });

  } catch (error) {
    console.error('Error adding room:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 5. GET ALL ROOMS FOR A SPECIFIC HOTEL
// ==========================================
// GET /api/properties/:propertyId/rooms
router.get('/:propertyId/rooms', verifyToken, async (req, res) => {
  try {
    const rooms = await Room.find({ property: req.params.propertyId }).sort({ roomNumber: 1 });
    res.status(200).json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 6. GOD VIEW: GET ALL PROPERTIES (Super Admin Only)
// ==========================================
// GET /api/properties
router.get('/', verifyToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const allProps = await Property.find().sort({ createdAt: -1 });
    res.status(200).json(allProps);
  } catch (error) {
    console.error('Error fetching all properties globally:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;