const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
  identifier: { type: String, required: true, index: true }, // email or phone number
  purpose: {
    type: String,
    required: true,
    enum: ['PASSWORD_RESET', 'GUEST_VERIFY', 'EMAIL_VERIFY']
  },
  code: { type: String, required: true },       // 6-digit plain text
  attempts: { type: Number, default: 0 },        // max 5 failed attempts
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 600 } // auto-delete after 10 min
});

// One active OTP per identifier+purpose at a time
OtpSchema.index({ identifier: 1, purpose: 1 });

module.exports = mongoose.model('Otp', OtpSchema);
