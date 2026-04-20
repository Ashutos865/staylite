const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Property = require('../models/Property');
const { verifyToken } = require('../middleware/authMiddleware');

const ACCESS_TOKEN_EXPIRY = '2h';
const REFRESH_TOKEN_EXPIRY = '7d';

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
  const refreshToken = jwt.sign(
    { userId, role },
    process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET + '_refresh',
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
  return { accessToken, refreshToken };
};

// ==========================================
// POST /api/auth/login
// ==========================================
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('A valid email address is required.'),
  body('password').notEmpty().withMessage('Password is required.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials. User not found.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials. Incorrect password.' });

    if (user.suspended) {
      return res.status(403).json({ message: `Account suspended. ${user.suspendedReason ? user.suspendedReason : 'Contact the administrator.'}` });
    }

    // Block login during maintenance (DEVELOPER and SUPER_ADMIN can always log in)
    if (!['DEVELOPER', 'SUPER_ADMIN'].includes(user.role)) {
      try {
        const MaintenanceMode = require('../models/MaintenanceMode');
        const m = await MaintenanceMode.findOne().sort({ updatedAt: -1 });
        if (m) {
          const now = new Date();
          const scheduledActive = m.scheduledStart && m.scheduledStart <= now && (!m.scheduledEnd || m.scheduledEnd > now);
          if (m.isActive || scheduledActive) {
            return res.status(503).json({
              message: m.message || 'System is under maintenance. Please try again later.',
              maintenance: true
            });
          }
        }
      } catch { /* silent — don't block login on DB error */ }
    }

    const { accessToken, refreshToken } = generateTokens(user._id, user.role);

    // Store hashed refresh token in DB
    const salt = await bcrypt.genSalt(10);
    user.refreshToken = await bcrypt.hash(refreshToken, salt);
    user.lastLogin = new Date();
    await user.save();

    // Resolve hotel name for managers and owners
    let assignedPropertyName = null;
    let hotelCount = 0;
    if (user.role === 'HOTEL_MANAGER' && user.assignedProperty) {
      const prop = await Property.findById(user.assignedProperty).select('name');
      assignedPropertyName = prop?.name || null;
    } else if (user.role === 'PROPERTY_OWNER') {
      hotelCount = await Property.countDocuments({ owner: user._id });
    }

    res.status(200).json({
      message: 'Login successful',
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        maxHotelsAllowed: user.maxHotelsAllowed,
        assignedProperty: user.assignedProperty,
        assignedPropertyName,
        hotelCount,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// POST /api/auth/refresh
// Exchange a valid refresh token for a new access token
// ==========================================
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const { refreshToken } = req.body;

    // Verify the refresh token signature
    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET + '_refresh'
      );
    } catch {
      return res.status(401).json({ message: 'Invalid or expired refresh token. Please log in again.' });
    }

    // Find user and validate stored hash
    const user = await User.findById(decoded.userId);
    if (!user || !user.refreshToken) {
      return res.status(401).json({ message: 'Session not found. Please log in again.' });
    }

    const isTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isTokenValid) {
      return res.status(401).json({ message: 'Refresh token mismatch. Please log in again.' });
    }

    // Issue new access token (refresh token stays the same until it expires)
    const newAccessToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    res.status(200).json({ token: newAccessToken });

  } catch (error) {
    console.error('Refresh Token Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// POST /api/auth/logout
// Invalidates the refresh token server-side
// ==========================================
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(200).json({ message: 'Logged out.' });

    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET + '_refresh'
      );
    } catch {
      return res.status(200).json({ message: 'Logged out.' });
    }

    await User.findByIdAndUpdate(decoded.userId, { refreshToken: null });
    res.status(200).json({ message: 'Logged out successfully.' });

  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// GET /api/auth/status
// Lightweight suspension check — polled by active sessions
// ==========================================
router.get('/status', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('suspended suspendedReason');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.suspended) {
      return res.status(403).json({
        suspended: true,
        reason: user.suspendedReason || 'Contact the administrator.'
      });
    }
    res.json({ suspended: false });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
