const express = require('express');
const router = express.Router();
const { 
  adminLogin,
  userLogin, 
  verifyOTP, 
  resendOTP, 
  getUserInfo,
  unifiedLogin
} = require('../controllers/authController');
const { authenticateUser } = require('../middleware/auth');
const { otpSendLimiter } = require('../middleware/rateLimiter');

// Admin login (legacy)
router.post('/admin/login', adminLogin);

// OTP routes for end customers AND end users (both use same flow)
router.post('/user/login', otpSendLimiter, userLogin);
router.post('/user/verify', verifyOTP);
router.post('/user/resend', otpSendLimiter, resendOTP);

// Unified dashboard login (email/phone + password) for superadmin & client admin
router.post('/login', unifiedLogin);

// Protected routes for client admin
router.get('/user/me', authenticateUser, getUserInfo);

// Optional health check
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Auth routes are working' });
});

module.exports = router;