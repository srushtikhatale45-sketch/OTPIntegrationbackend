const rateLimit = require('express-rate-limit');

// Rate limiter for general API requests
const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes (must be a number, not string)
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use IP address as key
    return req.ip || req.connection.remoteAddress;
  }
});

// Stricter limiter for OTP sending
const otpSendLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute (must be a number)
  max: 5, // limit each IP to 5 OTP requests per minute
  message: { success: false, message: 'Too many OTP requests, please wait' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

// Limiter for admin endpoints
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { success: false, message: 'Too many admin requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

module.exports = { otpRateLimiter, otpSendLimiter, adminLimiter };