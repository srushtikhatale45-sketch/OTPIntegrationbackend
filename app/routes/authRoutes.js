const express = require('express');
const router = express.Router();
const { 
  adminLogin, 
  userLogin, 
  verifyOTP, 
  resendOTP, 
  getUserInfo 
} = require('../controllers/authController');
const { authenticateUser } = require('../middleware/auth');
const { otpSendLimiter } = require('../middleware/rateLimiter');

// Public routes
router.post('/admin/login', adminLogin);
router.post('/user/login', otpSendLimiter, userLogin);
router.post('/user/verify', verifyOTP);
router.post('/user/resend', otpSendLimiter, resendOTP);

// Protected routes
router.get('/user/me', authenticateUser, getUserInfo);

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Auth routes are working!',
    endpoints: {
      adminLogin: 'POST /api/auth/admin/login',
      userLogin: 'POST /api/auth/user/login',
      verifyOTP: 'POST /api/auth/user/verify',
      resendOTP: 'POST /api/auth/user/resend',
      getUserInfo: 'GET /api/auth/user/me'
    }
  });
});

module.exports = router;