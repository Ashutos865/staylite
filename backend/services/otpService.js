const Otp = require('../models/Otp');
const { sendOtpEmail } = require('./emailService');
const { sendOtpSms, sendOtpWhatsApp } = require('./smsService');

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

// Send a 6-digit OTP to an email address.
// purpose: 'PASSWORD_RESET' | 'GUEST_VERIFY'
const sendEmailOtp = async (email, purpose) => {
  await Otp.deleteMany({ identifier: email, purpose }); // clear any previous
  const code = generateCode();
  await Otp.create({ identifier: email, purpose, code });
  await sendOtpEmail(email, code, purpose);
};

// Send a 6-digit OTP to a phone number via SMS or WhatsApp.
// channel: 'SMS' | 'WHATSAPP'
const sendPhoneOtp = async (phone, channel = 'SMS') => {
  await Otp.deleteMany({ identifier: phone, purpose: 'GUEST_VERIFY' });
  const code = generateCode();
  await Otp.create({ identifier: phone, purpose: 'GUEST_VERIFY', code });
  if (channel === 'WHATSAPP') {
    await sendOtpWhatsApp(phone, code);
  } else {
    await sendOtpSms(phone, code);
  }
};

// Verify an OTP. Returns { ok: true } or { ok: false, error: '...' }.
// Marks the OTP as verified on success (so the booking route can check it).
const verifyOtp = async (identifier, purpose, code) => {
  const otp = await Otp.findOne({ identifier, purpose, verified: false });
  if (!otp) {
    return { ok: false, error: 'OTP expired or not found. Please request a new one.' };
  }
  if (otp.attempts >= 5) {
    await otp.deleteOne();
    return { ok: false, error: 'Too many incorrect attempts. Please request a new OTP.' };
  }
  if (otp.code !== String(code).trim()) {
    otp.attempts += 1;
    await otp.save();
    const left = 5 - otp.attempts;
    return { ok: false, error: `Incorrect OTP. ${left} attempt${left === 1 ? '' : 's'} remaining.` };
  }
  // Mark verified so booking creation can confirm phone ownership
  otp.verified = true;
  await otp.save();
  return { ok: true };
};

module.exports = { sendEmailOtp, sendPhoneOtp, verifyOtp };
