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
const { refreshAccessToken, logout } = require('../controllers/authController');

// Admin route
router.post('/admin/login', adminLogin);

// User OTP routes (for end customers)
router.post('/user/login', otpSendLimiter, userLogin);
router.post('/user/verify', verifyOTP);
router.post('/user/resend', otpSendLimiter, resendOTP);
router.post('/refresh', refreshAccessToken);
router.post('/logout', logout);

// Unified dashboard login (email/phone + password)
router.post('/login', unifiedLogin);

// Protected route
router.get('/user/me', authenticateUser, getUserInfo);

module.exports = router;