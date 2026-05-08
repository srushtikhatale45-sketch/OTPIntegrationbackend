// Temporary disable rate limiting for development
// This will completely remove the warnings

// Dummy middleware that does nothing
const noOpMiddleware = (req, res, next) => next();

// Export no-op middleware for development
const otpRateLimiter = noOpMiddleware;
const otpSendLimiter = noOpMiddleware;
const adminLimiter = noOpMiddleware;
const verifyLimiter = noOpMiddleware;

module.exports = { 
  otpRateLimiter, 
  otpSendLimiter, 
  adminLimiter, 
  verifyLimiter 
};