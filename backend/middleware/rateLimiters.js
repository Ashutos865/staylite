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

// Auth limiter: 30 attempts / 15 min (raised from 20)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' }
});

const resetIP = (ip) => {
  generalLimiter.resetKey(ip);
  authLimiter.resetKey(ip);
};

const getLimiterConfig = () => ({
  general: { windowMs: 15 * 60 * 1000, max: 300, description: '300 req / 15 min (unauthenticated IPs only — authenticated users are exempt)' },
  auth:    { windowMs: 15 * 60 * 1000, max: 30,  description: '30 attempts / 15 min on auth routes' }
});

module.exports = { generalLimiter, authLimiter, resetIP, getLimiterConfig };
