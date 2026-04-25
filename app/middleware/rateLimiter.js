const rateLimit = require('express-rate-limit');

const otpRateLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 900000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: { success: false, message: 'Too many requests, please try again later' },
  keyGenerator: (req) => req.ip
});

const otpSendLimiter = rateLimit({
  windowMs: 60000,
  max: 5,
  message: { success: false, message: 'Too many OTP requests, please wait' }
});

module.exports = { otpRateLimiter, otpSendLimiter };