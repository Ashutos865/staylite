const Log = require('../models/Log');

// --- Device / Browser / OS parsers (no external library needed) ---
const parseDevice = (ua = '') => {
  if (!ua) return 'Unknown';
  if (/bot|crawler|spider|slurp|bingbot|googlebot/i.test(ua)) return 'Bot';
  if (/mobile|android(?!.*tablet)|iphone|ipod|blackberry|windows phone/i.test(ua)) return 'Mobile';
  if (/tablet|ipad|playbook|silk|android.*tablet/i.test(ua)) return 'Tablet';
  return 'Desktop';
};

const parseBrowser = (ua = '') => {
  if (!ua) return 'Unknown';
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR|Opera/i.test(ua)) return 'Opera';
  if (/Firefox/i.test(ua)) return 'Firefox';
  if (/Chrome/i.test(ua)) return 'Chrome';
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  if (/MSIE|Trident/i.test(ua)) return 'IE';
  if (/PostmanRuntime/i.test(ua)) return 'Postman';
  return 'Other';
};

const parseOS = (ua = '') => {
  if (!ua) return 'Unknown';
  if (/Windows NT 10/i.test(ua)) return 'Windows 10/11';
  if (/Windows NT/i.test(ua)) return 'Windows';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Other';
};

const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
};

// Routes that should never be logged (noise reduction)
const SKIP_ROUTES = ['/favicon.ico', '/'];

const requestLogger = (req, res, next) => {
  // Skip health check and favicon
  if (SKIP_ROUTES.includes(req.path)) return next();

  const start = Date.now();
  const ua = req.headers['user-agent'] || '';
  const ip = getClientIp(req);

  // Intercept res.end to capture status code + timing after response is sent
  res.on('finish', async () => {
    try {
      const responseTime = Date.now() - start;
      const statusCode = res.statusCode;

      // Determine log type based on status code
      let type = 'REQUEST';
      if (statusCode >= 500) type = 'ERROR';
      else if (statusCode >= 400) type = 'WARNING';

      const logEntry = {
        type,
        method: req.method,
        route: req.path,
        statusCode,
        responseTime,
        ip,
        device: parseDevice(ua),
        browser: parseBrowser(ua),
        os: parseOS(ua),
        userAgent: ua,
        userId: req.user?.userId || null,
        userRole: req.user?.role || null,
        message: `${req.method} ${req.path} → ${statusCode} (${responseTime}ms)`
      };

      // Fire-and-forget — don't await to keep the request fast
      Log.create(logEntry).catch(() => {}); // silently ignore DB write failures
    } catch (_) { /* never crash on logging */ }
  });

  next();
};

// Manually log a one-off event (errors, warnings, info) from anywhere in the app
const logEvent = async (type, message, metadata = {}) => {
  try {
    await Log.create({ type, message, metadata });
  } catch (_) {}
};

module.exports = { requestLogger, logEvent, getClientIp, parseDevice, parseBrowser, parseOS };
