const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User'); 

// --- IMPORT THE SECURITY MIDDLEWARE ---
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// ==========================================
// 1. CREATE PROPERTY OWNER (Super Admin Only)
// ==========================================
// POST /api/admin/create-owner
// Notice: We added the middleware functions right before the async request!
router.post('/create-owner', verifyToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, email, password, maxHotelsAllowed } = req.body;

    // --- Validation Check ---
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create Owner
    const newOwner = new User({
      name,
      email,
      password: hashedPassword,
      role: 'PROPERTY_OWNER',
      maxHotelsAllowed: maxHotelsAllowed || 1 
    });

    await newOwner.save();

    res.status(201).json({
      message: 'Property Owner successfully created!',
      owner: {
        id: newOwner._id,
        name: newOwner.name,
        email: newOwner.email,
        maxHotelsAllowed: newOwner.maxHotelsAllowed
      }
    });

  } catch (error) {
    console.error('Error creating owner:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 1.5 GET ALL PROPERTY OWNERS (Admin Only)
// ==========================================
// GET /api/admin/owners
router.get('/owners', verifyToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    // Find all users with the role PROPERTY_OWNER. 
    // We use .select('-password') to ensure we NEVER send hashed passwords to the frontend!
    const owners = await User.find({ role: 'PROPERTY_OWNER' }).select('-password').sort({ createdAt: -1 });
    
    res.status(200).json(owners);
  } catch (error) {
    console.error('Error fetching owners:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 2. TEMPORARY SETUP SCRIPT (Run this ONCE)
// ==========================================
// GET /api/admin/setup
router.get('/setup', async (req, res) => {
  try {
    // Check if an admin already exists to prevent duplicates
    const adminExists = await User.findOne({ role: 'SUPER_ADMIN' });
    if (adminExists) {
      return res.status(400).json({ message: 'Super Admin already exists. Setup disabled.' });
    }

    // Create your master account
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt); // Default password: admin123

    const superAdmin = new User({
      name: 'Ashutosh Patra', // Master Admin!
      email: 'admin@ties.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    });

    await superAdmin.save();

    res.status(201).json({ 
      message: 'SUCCESS! Super Admin created.', 
      email: 'admin@ties.com',
      password: 'admin123' 
    });

  } catch (error) {
    res.status(500).json({ message: 'Setup Failed', error });
  }
});

module.exports = router;