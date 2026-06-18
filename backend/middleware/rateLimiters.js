const rateLimit = require('express-rate-limit');

// Once authenticated, rate-limiting users like anonymous bots causes
// "Too many requests" errors on dashboard-heavy pages. Skip for Bearer tokens.
const skipIfAuthenticated = (req) => {
  const auth = req.headers.authorization;
  return !!(auth && auth.startsWith('Bearer '));
};

// General limiter: 300 req / 15 min — only for unauthenticated IPs
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  skip: skipIfAuthenticated,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP. Please try again after 15 minutes.' }
});

// Login limiter: 20 failed attempts / 15 min
// skipSuccessfulRequests: successful logins don't count toward the cap.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many failed login attempts. Please try again after 15 minutes.' }
});

// Refresh limiter: 500 req / 15 min — silent background calls from every open tab.
// Must NOT share the login limiter; a user with 3 browser tabs refreshes tokens
// every 2h × 3 tabs = dozens of calls per day, all legitimate.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  skip: skipIfAuthenticated,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many token refresh requests. Please try again after 15 minutes.' }
});

const resetIP = (ip) => {
  generalLimiter.resetKey(ip);
  authLimiter.resetKey(ip);
};

const getLimiterConfig = () => ({
  general: { windowMs: 15 * 60 * 1000, max: 300, description: '300 req / 15 min (unauthenticated IPs only — authenticated users are exempt)' },
  auth:    { windowMs: 15 * 60 * 1000, max: 20,  description: '20 failed attempts / 15 min — successful logins not counted' },
  refresh: { windowMs: 15 * 60 * 1000, max: 500, description: '500 req / 15 min — unauthenticated only; authenticated tabs are exempt' }
});

module.exports = { generalLimiter, authLimiter, refreshLimiter, resetIP, getLimiterConfig };
