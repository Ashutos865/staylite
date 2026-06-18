const Log = require('../models/Log');

// Manually log a human-readable audit/business event from anywhere in the app.
// type: 'INFO' | 'WARNING' | 'ERROR'
// message: plain English, e.g. "Rahul Sharma checked in at Hotel Grand"
// meta: optional extra fields saved alongside the message
const logEvent = async (type, message, meta = {}) => {
  try {
    await Log.create({ type, message, ...(Object.keys(meta).length ? { metadata: meta } : {}) });
  } catch (_) {}
};

// Only auto-log unhandled 500 server errors — everything else is captured
// via explicit logEvent() calls in the route handlers.
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', async () => {
    try {
      if (res.statusCode < 500) return; // only care about crashes

      const ms = Date.now() - start;
      await Log.create({
        type: 'ERROR',
        message: `Server error: ${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`,
        route:      req.path,
        method:     req.method,
        statusCode: res.statusCode,
        responseTime: ms,
        ip:       (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) || req.socket?.remoteAddress || 'unknown',
        userId:   req.user?.userId || null,
        userRole: req.user?.role   || null,
      });
    } catch (_) {}
  });

  next();
};

module.exports = { requestLogger, logEvent };
