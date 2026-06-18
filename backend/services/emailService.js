const nodemailer = require('nodemailer');

// Returns null when SMTP isn't configured yet — routes will stub-log the OTP instead.
const getTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const OTP_TEMPLATES = {
  PASSWORD_RESET: (code) => ({
    subject: 'Reset your StayLite password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">StayLite</h1>
          <p style="font-size:13px;color:#64748b;margin:4px 0 0;">Hotel Management Platform</p>
        </div>
        <div style="background:#fff;border-radius:10px;padding:28px;border:1px solid #e2e8f0;">
          <h2 style="font-size:18px;color:#1e293b;margin:0 0 8px;">Password Reset Request</h2>
          <p style="font-size:14px;color:#475569;margin:0 0 20px;">Use the OTP below to reset your password. It expires in <strong>10 minutes</strong>.</p>
          <div style="background:#eff6ff;border:2px dashed #3b82f6;border-radius:10px;padding:20px;text-align:center;margin-bottom:20px;">
            <p style="font-size:36px;font-weight:900;letter-spacing:12px;color:#1d4ed8;margin:0;font-family:monospace;">${code}</p>
          </div>
          <p style="font-size:12px;color:#94a3b8;margin:0;">If you didn't request this, you can safely ignore this email. Your password will not change.</p>
        </div>
        <p style="font-size:11px;color:#cbd5e1;text-align:center;margin-top:20px;">© StayLite · Do not reply to this email</p>
      </div>
    `
  }),
  GUEST_VERIFY: (code) => ({
    subject: 'Verify your email — StayLite booking',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">StayLite</h1>
          <p style="font-size:13px;color:#64748b;margin:4px 0 0;">Hotel Booking Platform</p>
        </div>
        <div style="background:#fff;border-radius:10px;padding:28px;border:1px solid #e2e8f0;">
          <h2 style="font-size:18px;color:#1e293b;margin:0 0 8px;">Verify your phone</h2>
          <p style="font-size:14px;color:#475569;margin:0 0 20px;">Your booking verification OTP. Valid for <strong>10 minutes</strong>.</p>
          <div style="background:#f0fdf4;border:2px dashed #22c55e;border-radius:10px;padding:20px;text-align:center;margin-bottom:20px;">
            <p style="font-size:36px;font-weight:900;letter-spacing:12px;color:#15803d;margin:0;font-family:monospace;">${code}</p>
          </div>
        </div>
      </div>
    `
  })
};

const sendOtpEmail = async (to, code, purpose) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL STUB] OTP for <${to}> (${purpose}): ${code}`);
    return;
  }
  const { subject, html } = OTP_TEMPLATES[purpose]?.(code) || OTP_TEMPLATES.PASSWORD_RESET(code);
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `StayLite <${process.env.SMTP_USER}>`,
    to,
    subject,
    html
  });
};

module.exports = { sendOtpEmail };
