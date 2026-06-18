const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { sendPhoneOtp, verifyOtp } = require('../services/otpService');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  next();
};

// Strict rate limit: 5 OTP requests per 10 minutes per IP to prevent SMS bombing
const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests. Please wait 10 minutes before trying again.' }
});

// ==========================================
// POST /api/otp/guest/send
// Send an OTP to a guest phone number before booking.
// Public — no auth required.
// Body: { phone: '+919876543210', channel: 'SMS' | 'WHATSAPP' }
// ==========================================
router.post('/guest/send', otpSendLimiter, [
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required.')
    .matches(/^\+?[0-9]{7,15}$/).withMessage('Enter a valid phone number (digits only, optionally starting with +).'),
  body('channel')
    .optional()
    .isIn(['SMS', 'WHATSAPP']).withMessage('Channel must be SMS or WHATSAPP.')
], validate, async (req, res) => {
  try {
    const { phone, channel = 'SMS' } = req.body;
    await sendPhoneOtp(phone.trim(), channel);
    res.json({ message: `OTP sent to ${phone} via ${channel}.` });
  } catch (err) {
    console.error('OTP send error:', err);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
});

// ==========================================
// POST /api/otp/guest/verify
// Verify a guest phone OTP.
// Body: { phone, code }
// Returns: { verified: true } or 400 with error message.
// ==========================================
router.post('/guest/verify', [
  body('phone').trim().notEmpty().withMessage('Phone number is required.'),
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits.')
], validate, async (req, res) => {
  try {
    const { phone, code } = req.body;
    const result = await verifyOtp(phone.trim(), 'GUEST_VERIFY', code.trim());
    if (!result.ok) return res.status(400).json({ message: result.error });
    res.json({ verified: true, phone: phone.trim() });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
