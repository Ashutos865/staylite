const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const Property = require('../models/Property');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  next();
};

// ==========================================
// 1. RAISE A SUPPORT TICKET
// ==========================================
// POST /api/support/tickets
router.post('/tickets', [
  body('subject').trim().notEmpty().withMessage('Subject is required.').isLength({ max: 150 }),
  body('description').trim().notEmpty().withMessage('Description is required.').isLength({ max: 2000 }),
  body('category').isIn(['BUG_REPORT','FEATURE_REQUEST','TECHNICAL_ISSUE','BILLING','OTHER']).withMessage('Invalid category.'),
  body('priority').optional().isIn(['LOW','MEDIUM','HIGH','URGENT'])
], validate, async (req, res) => {
  try {
    const { subject, description, category, priority = 'MEDIUM' } = req.body;
    const { userId, role } = req.user;

    // Find associated property
    let propertyId = null;
    if (role === 'HOTEL_MANAGER') {
      const mgr = await User.findById(userId);
      propertyId = mgr.assignedProperty;
    } else if (role === 'PROPERTY_OWNER') {
      // Attach first active property as context
      const prop = await Property.findOne({ owner: userId, status: 'ACTIVE' });
      if (prop) propertyId = prop._id;
    }

    const ticket = await SupportTicket.create({
      raisedBy: userId,
      property: propertyId,
      subject, description, category, priority
    });

    res.status(201).json({ message: 'Ticket submitted successfully. Our developer team will respond shortly.', ticket });
  } catch (error) {
    console.error('Support ticket error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 2. GET MY TICKETS (for the reporter)
// ==========================================
// GET /api/support/tickets/mine
router.get('/tickets/mine', async (req, res) => {
  try {
    const fifteenHoursAgo = new Date(Date.now() - 15 * 60 * 60 * 1000);
    // Resolved/Closed tickets disappear 15h after the reporter first views them
    const tickets = await SupportTicket.find({
      raisedBy: req.user.userId,
      $or: [
        { status: { $in: ['OPEN', 'IN_PROGRESS'] } },
        {
          status: { $in: ['RESOLVED', 'CLOSED'] },
          $or: [
            { reporterViewedAt: null },
            { reporterViewedAt: { $gt: fifteenHoursAgo } }
          ]
        }
      ]
    })
      .populate('property', 'name')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 3. GET ALL TICKETS (developer only)
// ==========================================
// GET /api/support/tickets
router.get('/tickets', async (req, res) => {
  try {
    if (req.user.role !== 'DEVELOPER' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const { status, priority, category } = req.query;
    const query = {};
    if (status)   query.status   = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    const tickets = await SupportTicket.find(query)
      .populate('raisedBy', 'name email role')
      .populate('property', 'name')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 4. GET SINGLE TICKET
// ==========================================
// GET /api/support/tickets/:id
router.get('/tickets/:id', async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('raisedBy', 'name email role')
      .populate('property', 'name')
      .populate('assignedTo', 'name email')
      .populate('replies.fromUser', 'name role');

    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

    // Only the reporter or a developer/admin can view
    const isReporter = ticket.raisedBy._id.toString() === req.user.userId;
    const isDevOrAdmin = ['DEVELOPER', 'SUPER_ADMIN'].includes(req.user.role);
    if (!isReporter && !isDevOrAdmin) return res.status(403).json({ message: 'Access denied.' });

    // Mark first-view timestamp for reporter on resolved/closed tickets (starts 15h TTL)
    if (isReporter && ['RESOLVED', 'CLOSED'].includes(ticket.status) && !ticket.reporterViewedAt) {
      ticket.reporterViewedAt = new Date();
      await ticket.save();
    }

    res.json(ticket);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 5. UPDATE TICKET STATUS + RESOLUTION (developer only)
// ==========================================
// PATCH /api/support/tickets/:id
router.patch('/tickets/:id', async (req, res) => {
  try {
    if (!['DEVELOPER', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only developers can update ticket status.' });
    }

    const { status, resolutionNote, assignedTo } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

    if (status) ticket.status = status;
    if (resolutionNote) ticket.resolutionNote = resolutionNote;
    if (assignedTo) ticket.assignedTo = assignedTo;
    if (status === 'RESOLVED' && !ticket.resolvedAt) ticket.resolvedAt = new Date();

    await ticket.save();
    res.json({ message: 'Ticket updated.', ticket });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 6. ADD REPLY TO TICKET
// ==========================================
// POST /api/support/tickets/:id/reply
router.post('/tickets/:id/reply', [
  body('message').trim().notEmpty().withMessage('Reply message required.').isLength({ max: 1000 })
], validate, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

    const isReporter = ticket.raisedBy.toString() === req.user.userId;
    const isDevOrAdmin = ['DEVELOPER', 'SUPER_ADMIN'].includes(req.user.role);
    if (!isReporter && !isDevOrAdmin) return res.status(403).json({ message: 'Access denied.' });

    ticket.replies.push({ fromUser: req.user.userId, fromRole: req.user.role, message: req.body.message });
    if (req.user.role === 'DEVELOPER' && ticket.status === 'OPEN') ticket.status = 'IN_PROGRESS';
    await ticket.save();

    res.json({ message: 'Reply added.' });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 7. CHECKOUT ALERTS (manager-only endpoint)
// ==========================================
// GET /api/support/checkout-alerts
// Returns bookings checking out today for the logged-in manager's hotel
router.get('/checkout-alerts', async (req, res) => {
  try {
    if (req.user.role !== 'HOTEL_MANAGER') return res.json({ alerts: [] });

    const manager = await User.findById(req.user.userId);
    if (!manager.assignedProperty) return res.json({ alerts: [] });

    const Booking = require('../models/Booking');
    const today = new Date();
    const start = new Date(today); start.setHours(0, 0, 0, 0);
    const end   = new Date(today); end.setHours(23, 59, 59, 999);

    const alerts = await Booking.find({
      property: manager.assignedProperty,
      checkOut: { $gte: start, $lte: end },
      status: { $in: ['CONFIRMED', 'CHECKED_IN'] }
    }).select('guestName guestPhone checkOut assignedRooms');

    res.json({ alerts, date: today });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
