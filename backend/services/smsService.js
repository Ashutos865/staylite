// Twilio SMS + WhatsApp service.
// When TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not set, OTPs are stub-logged
// to the console so the app works in dev without credentials.

const getTwilioClient = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  // Lazy-require so missing package doesn't crash the server on startup
  try {
    const twilio = require('twilio');
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch {
    console.warn('[SMS] twilio package unavailable — falling back to stub logging');
    return null;
  }
};

const sendOtpSms = async (to, code) => {
  const client = getTwilioClient();
  if (!client) {
    console.log(`[SMS STUB] OTP for ${to}: ${code}`);
    return;
  }
  await client.messages.create({
    from: process.env.TWILIO_FROM_NUMBER,
    to,
    body: `Your StayLite OTP is: ${code}\nValid for 10 minutes. Do not share this with anyone.`
  });
};

const sendOtpWhatsApp = async (to, code) => {
  const client = getTwilioClient();
  if (!client) {
    console.log(`[WHATSAPP STUB] OTP for ${to}: ${code}`);
    return;
  }
  // Twilio sandbox WhatsApp number — replace TWILIO_WHATSAPP_FROM with your approved number in prod
  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
    to: `whatsapp:${to}`,
    body: `*StayLite* booking verification\n\nYour OTP: *${code}*\nValid for 10 minutes. Do not share this code.`
  });
};

module.exports = { sendOtpSms, sendOtpWhatsApp };
