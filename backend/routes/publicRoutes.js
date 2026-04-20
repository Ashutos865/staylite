const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Property = require('../models/Property');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const UploadToken = require('../models/UploadToken');
const { uploadToR2, isConfigured } = require('../utils/r2');

// Multer memory storage for ID proof uploads
const idUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ok = /jpeg|jpg|png|webp|pdf/.test(ext) && /image\/|application\/pdf/.test(file.mimetype);
    cb(ok ? null : new Error('Only images (JPEG/PNG/WebP) or PDF allowed.'), ok);
  }
});

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  next();
};

// ==========================================
// HELPERS
// ==========================================
const CATEGORY_META = {
  STANDARD_NON_AC: { label: 'Standard Room', reqType: 'NON_AC', tag: 'Non-AC' },
  DELUXE_AC:       { label: 'Deluxe Room',   reqType: 'AC',     tag: 'AC' },
  PREMIUM_SUITE:   { label: 'Premium Suite', reqType: 'AC',     tag: 'AC · Suite' },
};

const groupRoomsByCategory = (rooms) => {
  const map = {};
  for (const room of rooms) {
    const cat = room.category;
    if (!map[cat]) {
      map[cat] = { category: cat, ...CATEGORY_META[cat], minPrice: room.basePrice, maxPrice: room.basePrice, totalRooms: 0, capacity: room.capacity };
    }
    map[cat].totalRooms++;
    if (room.basePrice < map[cat].minPrice) map[cat].minPrice = room.basePrice;
    if (room.basePrice > map[cat].maxPrice) map[cat].maxPrice = room.basePrice;
  }
  // Sort: Standard → Deluxe → Suite
  const order = ['STANDARD_NON_AC', 'DELUXE_AC', 'PREMIUM_SUITE'];
  return order.filter(k => map[k]).map(k => map[k]);
};

// ==========================================
// 1. LIST ALL ACTIVE HOTELS
// ==========================================
// GET /api/public/hotels?search=&city=
router.get('/hotels', async (req, res) => {
  try {
    const { search, city } = req.query;
    const query = { status: 'ACTIVE' };

    if (search) {
      query.$or = [
        { name:    { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { city:    { $regex: search, $options: 'i' } }
      ];
    }
    if (city) query.city = { $regex: city, $options: 'i' };

    const hotels = await Property.find(query).select('-owner').sort({ createdAt: -1 });

    const result = await Promise.all(hotels.map(async (hotel) => {
      const rooms = await Room.find({ property: hotel._id });
      return {
        ...hotel.toObject(),
        roomCategories: groupRoomsByCategory(rooms),
        totalRooms: rooms.length
      };
    }));

    res.json(result);
  } catch (error) {
    console.error('Public hotels list error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 2. GET HOTEL DETAIL + ROOMS
// ==========================================
// GET /api/public/hotels/:id
router.get('/hotels/:id', async (req, res) => {
  try {
    const hotel = await Property.findById(req.params.id).select('-owner');
    if (!hotel || hotel.status !== 'ACTIVE') {
      return res.status(404).json({ message: 'Hotel not found.' });
    }

    const rooms = await Room.find({ property: hotel._id });

    res.json({
      ...hotel.toObject(),
      roomCategories: groupRoomsByCategory(rooms),
      totalRooms: rooms.length
    });
  } catch (error) {
    console.error('Public hotel detail error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 3. ROOM AVAILABILITY FOR GIVEN DATES
// ==========================================
// GET /api/public/hotels/:id/availability?checkIn=&checkOut=
router.get('/hotels/:id/availability', async (req, res) => {
  try {
    const { checkIn, checkOut } = req.query;
    if (!checkIn || !checkOut) {
      return res.status(400).json({ message: 'checkIn and checkOut dates are required.' });
    }

    const checkInDate  = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (checkInDate >= checkOutDate) {
      return res.status(400).json({ message: 'checkOut must be after checkIn.' });
    }

    const rooms = await Room.find({ property: req.params.id });

    // Build map: category → total room count + list of room IDs
    const catMap = {};
    for (const room of rooms) {
      if (!catMap[room.category]) catMap[room.category] = { total: 0, roomIds: [], reqType: CATEGORY_META[room.category]?.reqType };
      catMap[room.category].total++;
      catMap[room.category].roomIds.push(room._id.toString());
    }

    // Count rooms physically assigned to overlapping CONFIRMED/CHECKED_IN bookings
    const activeBookings = await Booking.find({
      property: req.params.id,
      status: { $in: ['CONFIRMED', 'CHECKED_IN'] },
      $and: [{ checkIn: { $lt: checkOutDate } }, { checkOut: { $gt: checkInDate } }]
    });

    const assignedIds = new Set();
    for (const bkg of activeBookings) {
      for (const ar of bkg.assignedRooms) assignedIds.add(ar.room.toString());
    }

    // Count PENDING_ASSIGNMENT overlapping bookings (unassigned but reserved slots)
    // Each such booking holds `guestCount` room slots (guestCount = rooms requested online)
    const pendingBookings = await Booking.find({
      property: req.params.id,
      status: 'PENDING_ASSIGNMENT',
      $and: [{ checkIn: { $lt: checkOutDate } }, { checkOut: { $gt: checkInDate } }]
    });

    // Tally pending holds by reqType
    const pendingHolds = { AC: 0, NON_AC: 0 };
    for (const bkg of pendingBookings) {
      pendingHolds[bkg.reqType] = (pendingHolds[bkg.reqType] || 0) + (bkg.guestCount || 1);
    }

    // Build availability per category
    const order = ['STANDARD_NON_AC', 'DELUXE_AC', 'PREMIUM_SUITE'];
    const result = order.filter(cat => catMap[cat]).map(cat => {
      const data = catMap[cat];
      const physicallyAssigned = data.roomIds.filter(id => assignedIds.has(id)).length;
      // Distribute pending holds proportionally across categories sharing the same reqType
      const siblingCats = order.filter(c => catMap[c]?.reqType === data.reqType);
      const pendingShare = Math.ceil((pendingHolds[data.reqType] || 0) / siblingCats.length);
      const occupied  = physicallyAssigned + pendingShare;
      const available = Math.max(0, data.total - occupied);

      return {
        category: cat,
        ...CATEGORY_META[cat],
        total: data.total,
        occupied,
        available,
        soldOut: available === 0
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 4. CREATE GUEST BOOKING (no auth required)
// ==========================================
// POST /api/public/bookings
router.post('/bookings', [
  body('propertyId').notEmpty().withMessage('Hotel is required.'),
  body('guestName').trim().notEmpty().withMessage('Your name is required.'),
  body('guestPhone').trim().isMobilePhone().withMessage('A valid phone number is required.'),
  body('guestEmail').optional({ checkFalsy: true }).isEmail().withMessage('Please enter a valid email address.'),
  body('roomsRequested').isInt({ min: 1 }).withMessage('Number of rooms must be at least 1.'),
  body('checkIn').isISO8601().withMessage('A valid check-in date is required.'),
  body('checkOut').isISO8601().withMessage('A valid check-out date is required.')
    .custom((checkOut, { req }) => {
      if (new Date(checkOut) <= new Date(req.body.checkIn)) {
        throw new Error('Check-out must be after check-in.');
      }
      return true;
    }),
  body('bookingType').isIn(['FULL_DAY', 'HALF_DAY']).withMessage('Booking type must be FULL_DAY or HALF_DAY.'),
  body('reqType').isIn(['AC', 'NON_AC']).withMessage('Room type must be AC or NON_AC.'),
  body('paymentMethod').isIn(['CASH', 'CASHFREE']).withMessage('Payment method must be CASH or CASHFREE.')
], validate, async (req, res) => {
  try {
    const { propertyId, guestName, guestPhone, guestEmail, roomsRequested, checkIn, checkOut, bookingType, reqType, paymentMethod } = req.body;
    const numRooms = Number(roomsRequested) || 1;

    const hotel = await Property.findById(propertyId);
    if (!hotel || hotel.status !== 'ACTIVE') {
      return res.status(404).json({ message: 'Hotel not found.' });
    }

    const checkInDate  = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Get rooms matching reqType — exact category match to avoid 'AC' regex hitting 'STANDARD_NON_AC'
    const matchingCategories = Object.entries(CATEGORY_META)
      .filter(([, meta]) => meta.reqType === reqType)
      .map(([cat]) => cat);
    const matchingRooms = await Room.find({ property: propertyId, category: { $in: matchingCategories } });
    if (matchingRooms.length === 0) {
      return res.status(400).json({ message: `No ${reqType} rooms available at this hotel. Please choose a different room type.` });
    }

    // Availability validation
    const activeBookings = await Booking.find({
      property: propertyId,
      reqType,
      status: { $in: ['CONFIRMED', 'CHECKED_IN'] },
      $and: [{ checkIn: { $lt: checkOutDate } }, { checkOut: { $gt: checkInDate } }]
    });
    const assignedCount = activeBookings.reduce((n, b) => n + (b.assignedRooms?.length || 0), 0);

    const pendingCount = await Booking.aggregate([
      { $match: {
        property: hotel._id,
        reqType,
        status: 'PENDING_ASSIGNMENT',
        $and: [{ checkIn: { $lt: checkOutDate } }, { checkOut: { $gt: checkInDate } }]
      }},
      { $group: { _id: null, total: { $sum: '$guestCount' } } }
    ]);
    const pendingHeld = pendingCount[0]?.total || 0;

    const available = Math.max(0, matchingRooms.length - assignedCount - pendingHeld);
    if (numRooms > available) {
      if (available === 0) {
        return res.status(400).json({
          message: `All ${reqType === 'AC' ? 'AC' : 'Non-AC'} rooms are fully booked for these dates. Please try different dates or room type.`,
          availableRooms: 0
        });
      }
      return res.status(400).json({
        message: `Only ${available} room(s) available for these dates. You requested ${numRooms}.`,
        availableRooms: available
      });
    }

    const minPrice = Math.min(...matchingRooms.map(r => r.basePrice));
    const nights = Math.max(1, Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));
    const totalAmount = minPrice * nights * numRooms;

    const newBooking = new Booking({
      property:      propertyId,
      bookedBy:      null,
      guestName,
      guestPhone,
      guestEmail:    guestEmail || '',
      guestCount:    numRooms,   // stores "rooms requested" for online bookings
      bookingType,
      checkIn:       checkInDate,
      checkOut:      checkOutDate,
      reqType,
      totalAmount,
      advancePaid:   0,
      paymentMethod: paymentMethod || 'CASH',
      paymentStatus: 'PENDING',
      source:        'ONLINE',
      status:        'PENDING_ASSIGNMENT',
      assignedRooms: [],
      transactions:  []
    });

    await newBooking.save();

    res.status(201).json({
      message:      'Booking confirmed! Your room(s) will be assigned by hotel staff.',
      bookingId:    newBooking._id,
      bookingRef:   newBooking._id.toString().slice(-8).toUpperCase(),
      totalAmount:  newBooking.totalAmount,
      hotelName:    hotel.name,
      hotelContact: hotel.contactNumber || '',
      checkIn:      newBooking.checkIn,
      checkOut:     newBooking.checkOut,
      roomsBooked:  numRooms
    });

  } catch (error) {
    console.error('Public booking create error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 4. CREATE CASHFREE PAYMENT ORDER
// ==========================================
// POST /api/public/payments/order
router.post('/payments/order', async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ message: 'Booking ID is required.' });

    const booking = await Booking.findById(bookingId).populate('property', 'name');
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    if (booking.paymentStatus === 'PAID') {
      return res.status(400).json({ message: 'This booking is already paid.' });
    }

    const appId     = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const env       = process.env.CASHFREE_ENV || 'TEST';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (!appId || !secretKey) {
      return res.status(503).json({ message: 'Online payment is not configured. Please pay at the hotel.' });
    }

    const baseUrl = env === 'PROD'
      ? 'https://api.cashfree.com/pg/orders'
      : 'https://sandbox.cashfree.com/pg/orders';

    const orderId = `SL_${booking._id.toString().slice(-8).toUpperCase()}_${Date.now()}`;

    const cfResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version':    '2023-08-01',
        'x-client-id':      appId,
        'x-client-secret':  secretKey
      },
      body: JSON.stringify({
        order_id:     orderId,
        order_amount: booking.totalAmount,
        order_currency: 'INR',
        customer_details: {
          customer_id:    booking._id.toString(),
          customer_phone: booking.guestPhone,
          customer_email: booking.guestEmail || 'guest@staylite.in',
          customer_name:  booking.guestName
        },
        order_meta: {
          return_url: `${frontendUrl}/book?cf_order_id={order_id}&booking_id=${booking._id}`
        }
      })
    });

    const cfData = await cfResponse.json();

    if (!cfResponse.ok) {
      console.error('Cashfree order error:', cfData);
      return res.status(502).json({ message: 'Payment gateway error. Please try again or pay at hotel.' });
    }

    // Persist order ID on booking
    booking.cashfreeOrderId = orderId;
    await booking.save();

    res.json({
      paymentSessionId: cfData.payment_session_id,
      orderId:          cfData.order_id,
      amount:           booking.totalAmount,
      environment:      env
    });

  } catch (error) {
    console.error('Cashfree order create error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 5. VERIFY CASHFREE PAYMENT
// ==========================================
// POST /api/public/payments/verify
router.post('/payments/verify', async (req, res) => {
  try {
    const { orderId, bookingId } = req.body;
    if (!orderId || !bookingId) {
      return res.status(400).json({ message: 'orderId and bookingId are required.' });
    }

    const appId     = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const env       = process.env.CASHFREE_ENV || 'TEST';

    const baseUrl = env === 'PROD'
      ? `https://api.cashfree.com/pg/orders/${orderId}`
      : `https://sandbox.cashfree.com/pg/orders/${orderId}`;

    const cfResponse = await fetch(baseUrl, {
      headers: {
        'x-api-version':   '2023-08-01',
        'x-client-id':     appId,
        'x-client-secret': secretKey
      }
    });

    const cfData = await cfResponse.json();

    if (cfData.order_status === 'PAID') {
      const booking = await Booking.findById(bookingId);
      if (booking && booking.paymentStatus !== 'PAID') {
        booking.paymentStatus     = 'PAID';
        booking.advancePaid       = booking.totalAmount;
        booking.paymentMethod     = 'CASHFREE';
        booking.cashfreePaymentId = cfData.cf_order_id || orderId;
        booking.transactions.push({
          amount: booking.totalAmount,
          method: 'CASHFREE',
          date:   new Date(),
          type:   'ADVANCE'
        });
        await booking.save();
      }
      return res.json({ status: 'PAID', message: 'Payment verified successfully!' });
    }

    res.json({ status: cfData.order_status || 'PENDING', message: 'Payment not yet confirmed.' });

  } catch (error) {
    console.error('Cashfree verify error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 6. TRACK BOOKING BY ID
// ==========================================
// GET /api/public/bookings/:id
router.get('/bookings/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('property', 'name address contactNumber city')
      .populate('assignedRooms.room', 'roomNumber category');

    if (!booking) return res.status(404).json({ message: 'Booking not found. Please check your reference ID.' });

    // Only expose safe fields to the public
    res.json({
      bookingRef:    booking._id.toString().slice(-8).toUpperCase(),
      bookingId:     booking._id,
      status:        booking.status,
      paymentStatus: booking.paymentStatus,
      guestName:     booking.guestName,
      guestCount:    booking.guestCount,
      hotel:         booking.property?.name,
      hotelAddress:  booking.property?.address,
      hotelCity:     booking.property?.city,
      hotelContact:  booking.property?.contactNumber,
      checkIn:       booking.checkIn,
      checkOut:      booking.checkOut,
      reqType:       booking.reqType,
      bookingType:   booking.bookingType,
      totalAmount:   booking.totalAmount,
      advancePaid:   booking.advancePaid,
      paymentMethod: booking.paymentMethod,
      assignedRooms: booking.assignedRooms,
      source:        booking.source,
      createdAt:     booking.createdAt
    });
  } catch {
    res.status(400).json({ message: 'Invalid booking reference. Please check and try again.' });
  }
});

// ==========================================
// 7. GENERATE QR UPLOAD TOKEN (for ID proof)
// ==========================================
// POST /api/public/upload-token
router.post('/upload-token', async (req, res) => {
  try {
    const token     = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await UploadToken.create({ token, expiresAt });
    res.json({ token, expiresAt });
  } catch (error) {
    console.error('Upload token error:', error);
    res.status(500).json({ message: 'Failed to generate upload token.' });
  }
});

// ==========================================
// 8. GUEST UPLOADS ID PROOF VIA QR LINK
// ==========================================
// POST /api/public/upload-id/:token  (multipart, field: "idPhoto")
router.post('/upload-id/:token', idUpload.single('idPhoto'), async (req, res) => {
  try {
    const tokenDoc = await UploadToken.findOne({
      token:     req.params.token,
      expiresAt: { $gt: new Date() }
    });
    if (!tokenDoc) {
      return res.status(404).json({ message: 'QR code expired or invalid. Ask staff to generate a new one.' });
    }
    if (tokenDoc.status === 'UPLOADED') {
      return res.status(400).json({ message: 'ID already uploaded for this QR code.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided.' });
    }
    if (!isConfigured()) {
      return res.status(503).json({ message: 'File storage is not configured. Please ask staff to note your ID manually.' });
    }

    const fileUrl = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype);

    tokenDoc.status  = 'UPLOADED';
    tokenDoc.fileUrl = fileUrl;
    await tokenDoc.save();

    res.json({ message: 'ID proof uploaded successfully!', fileUrl });
  } catch (error) {
    console.error('ID upload error:', error);
    res.status(500).json({ message: error.message || 'Upload failed. Please try again.' });
  }
});

// ==========================================
// 9. POLL UPLOAD STATUS (staff side polling)
// ==========================================
// GET /api/public/upload-status/:token
router.get('/upload-status/:token', async (req, res) => {
  try {
    const tokenDoc = await UploadToken.findOne({ token: req.params.token });
    if (!tokenDoc) return res.status(404).json({ status: 'NOT_FOUND' });

    if (tokenDoc.status === 'PENDING' && tokenDoc.expiresAt < new Date()) {
      return res.json({ status: 'EXPIRED' });
    }

    res.json({
      status:    tokenDoc.status,
      fileUrl:   tokenDoc.fileUrl,
      expiresAt: tokenDoc.expiresAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check status.' });
  }
});

module.exports = router;
