const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Property = require('../models/Property');
const User = require('../models/User');
const { verifyToken } = require('../middleware/authMiddleware');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  next();
};

// ==========================================
// 1. CREATE A NEW BOOKING & INITIAL TRANSACTION
// ==========================================
router.post('/create', verifyToken, [
  body('propertyId').notEmpty().withMessage('Property ID is required.'),
  body('guestName').trim().notEmpty().withMessage('Guest name is required.'),
  body('guestPhone').trim().isMobilePhone().withMessage('A valid guest phone number is required.'),
  body('guestCount').isInt({ min: 1 }).withMessage('Guest count must be at least 1.'),
  body('checkIn').isISO8601().withMessage('A valid check-in date is required.'),
  body('checkOut').isISO8601().withMessage('A valid check-out date is required.')
    .custom((checkOut, { req }) => {
      if (new Date(checkOut) <= new Date(req.body.checkIn)) {
        throw new Error('Check-out date must be after check-in date.');
      }
      return true;
    }),
  body('bookingType').isIn(['FULL_DAY', 'HALF_DAY']).withMessage('Booking type must be FULL_DAY or HALF_DAY.'),
  body('reqType').isIn(['AC', 'NON_AC']).withMessage('Room type must be AC or NON_AC.'),
  body('totalAmount').optional().isFloat({ min: 0 }).withMessage('Total amount must be a positive number.'),
  body('advancePaid').optional().isFloat({ min: 0 }).withMessage('Advance paid must be a positive number.'),
  body('paymentMethod').optional().isIn(['CASH', 'UPI', 'CARD']).withMessage('Payment method must be CASH, UPI, or CARD.')
], validate, async (req, res) => {
  try {
    const {
      guestName, guestPhone, guestCount, bookingType, checkIn, checkOut, reqType,
      totalAmount, advancePaid, paymentMethod, propertyId
    } = req.body;

    console.log(`🛎️ New Reservation for ${guestName} (${guestCount || 1} Guests) at Property ${propertyId}`);

    // Create the initial transaction if they paid anything upfront
    const initialTransactions = [];
    if (Number(advancePaid) > 0) {
      initialTransactions.push({
        amount: Number(advancePaid),
        method: paymentMethod || 'UPI',
        date: new Date(),
        type: 'ADVANCE'
      });
    }

    const newBooking = new Booking({
      property: propertyId,
      bookedBy: req.user.userId, 
      guestName,
      guestPhone,
      guestCount: Number(guestCount) || 1, // Save the number of guests
      documentUrl: 'pending_upload', 
      bookingType,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      reqType, 
      totalAmount: totalAmount || 0,
      advancePaid: advancePaid || 0,
      paymentMethod: paymentMethod || 'UPI',
      transactions: initialTransactions, 
      status: 'PENDING_ASSIGNMENT',
      assignedRooms: [] // Starts empty until assignment
    });

    await newBooking.save();

    res.status(201).json({
      message: 'Reservation created successfully! Awaiting room assignment.',
      booking: newBooking
    });

  } catch (error) {
    console.error('Booking Creation Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 2. FETCH ALL BOOKINGS FOR A HOTEL
// ==========================================
// GET /api/bookings/property/:propertyId
router.get('/property/:propertyId', verifyToken, async (req, res) => {
  try {
    // RBAC: owners can only view their own properties; managers only their assigned one
    if (req.user.role === 'PROPERTY_OWNER') {
      const prop = await Property.findOne({ _id: req.params.propertyId, owner: req.user.userId });
      if (!prop) return res.status(403).json({ message: 'Access denied.' });
    } else if (req.user.role === 'HOTEL_MANAGER') {
      const manager = await User.findById(req.user.userId);
      if (manager.assignedProperty?.toString() !== req.params.propertyId) {
        return res.status(403).json({ message: 'Access denied.' });
      }
    }

    const bookings = await Booking.find({ property: req.params.propertyId })
      .populate('assignedRooms.room', 'roomNumber category capacity')
      .sort({ createdAt: -1 });
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 3. FETCH ONLY "PENDING" BOOKINGS
// ==========================================
// GET /api/bookings/property/:propertyId/pending
router.get('/property/:propertyId/pending', verifyToken, async (req, res) => {
  try {
    const pendingBookings = await Booking.find({ 
      property: req.params.propertyId, 
      status: 'PENDING_ASSIGNMENT' 
    }).sort({ createdAt: 1 }); 
    
    res.status(200).json(pendingBookings);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 4. ASSIGN ROOMS & CHECK FOR DATE OVERLAPS (MULTI-ROOM ENGINE)
// ==========================================
const mongoose = require('mongoose');

router.put('/:id/assign', verifyToken, async (req, res) => {
  const { assignments } = req.body;

  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({ message: 'Please select at least one room to assign.' });
  }

  const session = await mongoose.startSession();
  try {
    let result = null;

    await session.withTransaction(async () => {
      const booking = await Booking.findById(req.params.id).session(session);
      if (!booking) throw Object.assign(new Error('Booking not found.'), { status: 404 });

      let totalAssignedGuests = 0;
      let isAdjustmentNeeded = false;
      const newAssignedRooms = [];
      const assignedRoomNumbers = [];

      for (const assignment of assignments) {
        const { roomId, guestsInRoom } = assignment;
        totalAssignedGuests += Number(guestsInRoom);

        const room = await Room.findById(roomId).session(session);
        if (!room) throw Object.assign(new Error('Room not found.'), { status: 404 });

        if (!room.category.includes(booking.reqType)) {
          throw Object.assign(
            new Error(`Mismatch! Room ${room.roomNumber} is ${room.category}, but guest requested ${booking.reqType}.`),
            { status: 400 }
          );
        }

        // Overlap check runs inside the same transaction so no concurrent write can sneak in
        const overlappingBooking = await Booking.findOne({
          _id: { $ne: booking._id },
          'assignedRooms.room': roomId,
          status: { $in: ['CONFIRMED', 'CHECKED_IN'] },
          $and: [{ checkIn: { $lt: booking.checkOut } }, { checkOut: { $gt: booking.checkIn } }]
        }).session(session);

        if (overlappingBooking) {
          throw Object.assign(
            new Error(`Room ${room.roomNumber} is already booked during these dates/times! Please deselect it.`),
            { status: 400 }
          );
        }

        if (Number(guestsInRoom) > room.capacity) isAdjustmentNeeded = true;
        newAssignedRooms.push({ room: roomId, guestsInRoom: Number(guestsInRoom) });
        assignedRoomNumbers.push(room.roomNumber);
      }

      // For ONLINE bookings, guestCount stores rooms requested (not people), so skip people count check
      if (booking.source !== 'ONLINE' && totalAssignedGuests !== booking.guestCount) {
        throw Object.assign(
          new Error(`Guest mismatch! Booking is for ${booking.guestCount} guests, but you allocated ${totalAssignedGuests}.`),
          { status: 400 }
        );
      }

      // For ONLINE bookings, validate number of rooms assigned instead
      if (booking.source === 'ONLINE' && assignments.length !== booking.guestCount) {
        throw Object.assign(
          new Error(`Room count mismatch! Guest requested ${booking.guestCount} room(s), but you assigned ${assignments.length}.`),
          { status: 400 }
        );
      }

      booking.assignedRooms = newAssignedRooms;
      booking.status = 'CONFIRMED';
      await booking.save({ session });

      result = { booking, assignedRoomNumbers, isAdjustmentNeeded };
    });

    let successMessage = `Rooms ${result.assignedRoomNumbers.join(', ')} successfully assigned!`;
    if (result.isAdjustmentNeeded) successMessage += ' Note: Extra bed adjustments required due to room capacities.';

    res.status(200).json({ message: successMessage, booking: result.booking, isAdjustmentNeeded: result.isAdjustmentNeeded });

  } catch (error) {
    console.error('Room Assignment Error:', error);
    res.status(error.status || 500).json({ message: error.message || 'Internal Server Error' });
  } finally {
    session.endSession();
  }
});

// ==========================================
// 5. UPDATE BOOKING STATUS & LOG PAYMENTS
// ==========================================
// PUT /api/bookings/:id/status
router.put('/:id/status', verifyToken, async (req, res) => {
  try {
    const { status, additionalPayment, paymentMethod, documentUrl } = req.body;
    const bookingId = req.params.id;

    const validStatuses = ['PENDING_ASSIGNMENT', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status update provided.' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    booking.status = status;

    // Save ID proof URL if provided (staff uploads during check-in for online bookings)
    if (documentUrl && documentUrl !== 'pending_upload') {
      booking.documentUrl = documentUrl;
    }

    // --- FINANCIAL LEDGER UPDATE ---
    if (additionalPayment && Number(additionalPayment) > 0) {
      const paymentAmount = Number(additionalPayment);
      
      booking.advancePaid = (booking.advancePaid || 0) + paymentAmount;
      
      if (paymentMethod) {
        booking.paymentMethod = paymentMethod;
      }

      booking.transactions.push({
        amount: paymentAmount,
        method: paymentMethod || 'UPI',
        date: new Date(),
        type: status === 'CHECKED_IN' ? 'CHECK_IN' : (status === 'CHECKED_OUT' ? 'CHECK_OUT' : 'PAYMENT')
      });
    }

    await booking.save();

    res.status(200).json({ 
      message: `Booking successfully marked as ${status.replace('_', ' ')}`, 
      booking 
    });

  } catch (error) {
    console.error('Status Update Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 6. GOD VIEW: FETCH ALL BOOKINGS WITH FILTERS
// ==========================================
// GET /api/bookings/all
router.get('/all', verifyToken, async (req, res) => {
  try {
    const { propertyId, status, startDate, endDate, search } = req.query;
    let query = {};

    // --- 1. ROLE BASED ACCESS CONTROL ---
    if (req.user.role === 'PROPERTY_OWNER') {
      const myProperties = await Property.find({ owner: req.user.userId }).select('_id');
      query.property = { $in: myProperties.map(p => p._id) };
    } else if (req.user.role === 'HOTEL_MANAGER') {
      const manager = await User.findById(req.user.userId);
      query.property = manager.assignedProperty;
    }

    // --- 2. APPLY URL FILTERS ---
    if (propertyId && propertyId !== 'ALL') {
      if (query.property) {
        query = { $and: [{ property: query.property }, { property: propertyId }] };
      } else {
        query.property = propertyId;
      }
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      query.checkIn = { $gte: start, $lte: end };
    }

    if (search) {
      query.$or = [
        { guestName: { $regex: search, $options: 'i' } },
        { guestPhone: { $regex: search, $options: 'i' } }
      ];
    }

    // --- 3. EXECUTE ADVANCED QUERY ---
    const bookings = await Booking.find(query)
      .populate('property', 'name') 
      .populate('assignedRooms.room', 'roomNumber category capacity') 
      .sort({ checkIn: -1 });

    res.status(200).json(bookings);

  } catch (error) {
    console.error('God View Fetch Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 7. CRM: FETCH GUEST HISTORY BY PHONE
// ==========================================
// GET /api/bookings/guest/:phone
router.get('/guest/:phone', verifyToken, async (req, res) => {
  try {
    const { phone } = req.params;
    let query = { guestPhone: phone };

    // Apply RBAC: Ensure they only see guests from their allowed properties
    if (req.user.role === 'PROPERTY_OWNER') {
      const myProperties = await Property.find({ owner: req.user.userId }).select('_id');
      query.property = { $in: myProperties.map(p => p._id) };
    } else if (req.user.role === 'HOTEL_MANAGER') {
      const manager = await User.findById(req.user.userId);
      query.property = manager.assignedProperty;
    }

    // Find all bookings for this phone number, newest first
    const pastBookings = await Booking.find(query)
      .populate('property', 'name')
      .sort({ createdAt: -1 });

    if (!pastBookings || pastBookings.length === 0) {
      return res.status(404).json({ message: 'No past records found for this guest.' });
    }

    // Extract the most recent stay profile
    const latestStay = pastBookings[0];
    
    res.status(200).json({
      guestName: latestStay.guestName,
      documentUrl: latestStay.documentUrl,
      totalStays: pastBookings.length,
      history: pastBookings.slice(0, 5) // Return the last 5 stays for the UI card
    });

  } catch (error) {
    console.error('Guest CRM Fetch Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;