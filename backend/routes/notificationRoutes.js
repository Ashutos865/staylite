const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Notification = require('../models/Notification');
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
// 1. SEND NOTIFICATION
// ==========================================
// POST /api/notifications/send
router.post('/send', [
  body('title').trim().notEmpty().withMessage('Title is required.').isLength({ max: 100 }),
  body('message').trim().notEmpty().withMessage('Message is required.').isLength({ max: 500 }),
  body('template').optional().isIn(['CUSTOM','PAY_BILL','CONGRATS','WARNING','ACCOUNT_REVIEW','TASK_ASSIGN','DAILY_BRIEFING','SHIFT_ALERT','WELL_DONE','MAINTENANCE','SYSTEM_UPDATE','RESOLVED']),
  body('priority').optional().isIn(['NORMAL','IMPORTANT','URGENT']),
  body('animation').optional().isIn(['SLIDE','BOUNCE','CONFETTI','SHAKE','GLOW'])
], validate, async (req, res) => {
  try {
    const {
      title, message, template = 'CUSTOM', priority = 'NORMAL', animation = 'SLIDE',
      toUser, toRole, toProperty,
      scheduledFor,
      repeat
    } = req.body;
    const { userId, role } = req.user;

    const ALLOWED = {
      SUPER_ADMIN:     ['toUser', 'toRole'],
      PROPERTY_OWNER:  ['toUser', 'toProperty'],
      DEVELOPER:       ['toUser', 'toRole']
    };
    if (!ALLOWED[role]) return res.status(403).json({ message: 'Your role cannot send notifications.' });

    // Validate target exists
    if (toUser) {
      const target = await User.findById(toUser);
      if (!target) return res.status(404).json({ message: 'Target user not found.' });
    }
    if (toProperty) {
      const prop = await Property.findById(toProperty);
      if (!prop) return res.status(404).json({ message: 'Property not found.' });
    }

    const notifData = {
      fromRole: role, fromUser: userId,
      toUser: toUser || null, toRole: toRole || null, toProperty: toProperty || null,
      title, message, template, priority, animation,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null
    };
    if (repeat?.gapHours || repeat?.perDay || repeat?.tillDate) {
      notifData.repeat = {
        gapHours: repeat.gapHours || null,
        perDay:   repeat.perDay   || null,
        tillDate: repeat.tillDate ? new Date(repeat.tillDate) : null
      };
    }

    const notif = await Notification.create(notifData);

    res.status(201).json({ message: 'Notification sent.', notification: notif });
  } catch (error) {
    console.error('Notification send error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 2. GET MY NOTIFICATIONS (inbox)
// ==========================================
// GET /api/notifications/inbox
router.get('/inbox', async (req, res) => {
  try {
    const { userId, role } = req.user;
    const user = await User.findById(userId);

    const now = new Date();
    const query = {
      $and: [
        // Exclude notifications this user has already read+cleared
        { clearedBy: { $nin: [userId] } },
        // Only show notifications whose scheduled time has arrived
        { $or: [{ scheduledFor: null }, { scheduledFor: { $exists: false } }, { scheduledFor: { $lte: now } }] },
        // Target matching
        { $or: [
          { toUser: userId },
          { toRole: role },
          { toRole: 'ALL_STAFF' },
          ...(user.assignedProperty ? [{ toProperty: user.assignedProperty }] : [])
        ]}
      ]
    };

    const notifications = await Notification.find(query)
      .populate('fromUser', 'name role')
      .sort({ createdAt: -1 })
      .limit(50);

    // Attach isRead flag per notification
    const result = notifications.map(n => ({
      ...n.toObject(),
      isRead: n.readBy.some(id => id.toString() === userId)
    }));

    const unreadCount = result.filter(n => !n.isRead).length;

    res.json({ notifications: result, unreadCount });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 3. MARK AS READ
// ==========================================
// POST /api/notifications/:id/read
// Marks as read AND clears from inbox (won't appear again for this user)
router.post('/:id/read', async (req, res) => {
  try {
    const { userId } = req.user;
    await Notification.findByIdAndUpdate(req.params.id, {
      $addToSet: { readBy: userId, clearedBy: userId }
    });
    res.json({ message: 'Marked as read.' });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 4. MARK ALL AS READ
// ==========================================
// POST /api/notifications/read-all
router.post('/read-all', async (req, res) => {
  try {
    const { userId, role } = req.user;
    const user = await User.findById(userId);
    const query = {
      $or: [
        { toUser: userId },
        { toRole: role },
        { toRole: 'ALL_STAFF' },
        ...(user.assignedProperty ? [{ toProperty: user.assignedProperty }] : [])
      ]
    };
    await Notification.updateMany(query, { $addToSet: { readBy: userId, clearedBy: userId } });
    res.json({ message: 'All marked as read.' });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 5. GET USERS I CAN SEND TO (for compose dropdown)
// ==========================================
// GET /api/notifications/targets
router.get('/targets', async (req, res) => {
  try {
    const { userId, role } = req.user;

    let users = [];
    if (role === 'SUPER_ADMIN') {
      users = await User.find({ role: { $in: ['PROPERTY_OWNER', 'HOTEL_MANAGER', 'DEVELOPER'] } }).select('name email role assignedProperty');
    } else if (role === 'PROPERTY_OWNER') {
      // Owner can message their managers
      const props = await Property.find({ owner: userId }).select('_id name');
      const propIds = props.map(p => p._id);
      users = await User.find({ role: 'HOTEL_MANAGER', assignedProperty: { $in: propIds } }).select('name email role assignedProperty');
      // Also include properties for broadcast
      return res.json({ users, properties: props });
    } else if (role === 'DEVELOPER') {
      users = await User.find({ role: { $in: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'HOTEL_MANAGER'] } }).select('name email role');
    }

    res.json({ users, properties: [] });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
