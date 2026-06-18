const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Property = require('../models/Property');
const { verifyToken } = require('../middleware/authMiddleware');
const { logEvent } = require('../middleware/requestLogger');
const { sendEmailOtp, verifyOtp } = require('../services/otpService');

const RESET_TOKEN_EXPIRY = '15m'; // short-lived — only for the password reset flow

const ACCESS_TOKEN_EXPIRY = '2h';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const setRefreshCookie = (res, token) => {
  res.cookie('staylite_rt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: '/api/auth',
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie('staylite_rt', { path: '/api/auth' });
};

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

    setRefreshCookie(res, refreshToken);

    const ip = (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) || req.socket?.remoteAddress || 'unknown';
    logEvent('INFO', `${user.name} (${user.role}) logged in`, { email: user.email, ip });

    res.status(200).json({
      message: 'Login successful',
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        maxHotelsAllowed: user.maxHotelsAllowed,
        assignedProperty: user.assignedProperty,
        assignedPropertyName,
        hotelCount,
        lastLogin: user.lastLogin,
        isVerified:    user.isVerified    ?? true,
        emailVerified: user.emailVerified ?? true,
        phone:         user.phone || ''
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// POST /api/auth/refresh
// Exchange a valid refresh token (HttpOnly cookie) for a new access token
// ==========================================
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.staylite_rt;
    if (!refreshToken) {
      return res.status(401).json({ message: 'No session found. Please log in.' });
    }

    // Verify the refresh token signature
    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET + '_refresh'
      );
    } catch {
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'Invalid or expired session. Please log in again.' });
    }

    // Find user and validate stored hash
    const user = await User.findById(decoded.userId);
    if (!user || !user.refreshToken) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'Session not found. Please log in again.' });
    }

    const isTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isTokenValid) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'Session mismatch. Please log in again.' });
    }

    // Issue new access token (refresh cookie stays until it expires)
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
// Invalidates the refresh token server-side and clears the cookie
// ==========================================
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.staylite_rt;
    clearRefreshCookie(res);

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

// ==========================================
// GET /api/auth/me
// Returns full user profile for session restore after silent refresh
// ==========================================
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password -refreshToken');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    let assignedPropertyName = null;
    let hotelCount = 0;
    if (user.role === 'HOTEL_MANAGER' && user.assignedProperty) {
      const prop = await Property.findById(user.assignedProperty).select('name');
      assignedPropertyName = prop?.name || null;
    } else if (user.role === 'PROPERTY_OWNER') {
      hotelCount = await Property.countDocuments({ owner: user._id });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      maxHotelsAllowed: user.maxHotelsAllowed,
      assignedProperty: user.assignedProperty,
      assignedPropertyName,
      hotelCount,
      lastLogin: user.lastLogin,
      isVerified:    user.isVerified    ?? true,
      emailVerified: user.emailVerified ?? true,
      phone:         user.phone || ''
    });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// ACCOUNT VERIFICATION WALL
// Used by newly created PROPERTY_OWNER and HOTEL_MANAGER accounts.
// Step 1 — send email OTP:  POST /api/auth/verify-account/email/send
// Step 2 — verify email:    POST /api/auth/verify-account/email/verify   { code }
// Step 3 — send phone OTP:  POST /api/auth/verify-account/phone/send     { phone }
// Step 4 — verify phone:    POST /api/auth/verify-account/phone/verify   { phone, code }
// ==========================================

router.post('/verify-account/email/send', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.isVerified) return res.json({ message: 'Account already verified.' });
    await sendEmailOtp(user.email, 'EMAIL_VERIFY');
    res.json({ message: `OTP sent to ${user.email}` });
  } catch (err) {
    console.error('Email OTP send error:', err);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
});

router.post('/verify-account/email/verify', verifyToken, [
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.emailVerified) return res.json({ message: 'Email already verified.', emailVerified: true });
    const result = await verifyOtp(user.email, 'EMAIL_VERIFY', req.body.code);
    if (!result.ok) return res.status(400).json({ message: result.error });
    user.emailVerified = true;
    await user.save();
    res.json({ message: 'Email verified.', emailVerified: true });
  } catch (err) {
    console.error('Email OTP verify error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/verify-account/phone/send', verifyToken, [
  body('phone').trim().matches(/^\+?[0-9]{7,15}$/).withMessage('Enter a valid phone number.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!user.emailVerified) return res.status(400).json({ message: 'Please verify your email first.' });
    const { phone } = req.body;
    const { sendPhoneOtp } = require('../services/otpService');
    await sendPhoneOtp(phone.trim(), 'SMS');
    res.json({ message: `OTP sent to ${phone}` });
  } catch (err) {
    console.error('Phone OTP send error:', err);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
});

router.post('/verify-account/phone/verify', verifyToken, [
  body('phone').trim().matches(/^\+?[0-9]{7,15}$/).withMessage('Enter a valid phone number.'),
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!user.emailVerified) return res.status(400).json({ message: 'Please verify your email first.' });
    const { phone, code } = req.body;
    const result = await verifyOtp(phone.trim(), 'GUEST_VERIFY', code);
    if (!result.ok) return res.status(400).json({ message: result.error });
    user.phone = phone.trim();
    user.isVerified = true;
    await user.save();
    logEvent('INFO', `Account verified: ${user.name} (${user.role})`, { userId: user._id, email: user.email, phone });
    res.json({ message: 'Account fully verified! Welcome to StayLite.', isVerified: true, phone: user.phone });
  } catch (err) {
    console.error('Phone OTP verify error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// POST /api/auth/forgot-password
// Step 1: Send a 6-digit OTP to the user's registered email.
// Body: { email }
// ==========================================
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    // Always return success to avoid user-enumeration
    if (!user) return res.json({ message: 'If that email is registered, an OTP has been sent.' });
    await sendEmailOtp(email, 'PASSWORD_RESET');
    res.json({ message: 'If that email is registered, an OTP has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
});

// ==========================================
// POST /api/auth/verify-reset-otp
// Step 2: Verify the OTP and return a short-lived reset token.
// Body: { email, code }
// Returns: { resetToken } — valid 15 minutes, single-use
// ==========================================
router.post('/verify-reset-otp', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required.'),
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  try {
    const { email, code } = req.body;
    const result = await verifyOtp(email, 'PASSWORD_RESET', code);
    if (!result.ok) return res.status(400).json({ message: result.error });
    // Issue a short-lived JWT that only authorises a password reset
    const resetToken = jwt.sign(
      { email, purpose: 'PASSWORD_RESET' },
      process.env.JWT_SECRET,
      { expiresIn: RESET_TOKEN_EXPIRY }
    );
    res.json({ resetToken });
  } catch (err) {
    console.error('Verify reset OTP error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// POST /api/auth/reset-password
// Step 3: Set a new password using the reset token from step 2.
// Body: { resetToken, newPassword }
// ==========================================
router.post('/reset-password', [
  body('resetToken').notEmpty().withMessage('Reset token is required.'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  try {
    const { resetToken, newPassword } = req.body;
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: 'Reset link has expired. Please start over.' });
    }
    if (decoded.purpose !== 'PASSWORD_RESET') {
      return res.status(400).json({ message: 'Invalid reset token.' });
    }
    const user = await User.findOne({ email: decoded.email });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.refreshToken = null; // invalidate all existing sessions
    await user.save();
    logEvent('INFO', `Password reset for ${user.name} (${user.role})`, { email: user.email });
    res.json({ message: 'Password updated successfully. Please sign in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
