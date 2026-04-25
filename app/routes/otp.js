const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, getUserInfo } = require('../controllers/otpController');
const { authenticateUser } = require('../middleware/auth');
const { otpSendLimiter } = require('../middleware/rateLimiter');

router.post('/send', otpSendLimiter, sendOTP);
router.post('/verify', verifyOTP);
router.get('/me', authenticateUser, getUserInfo);

module.exports = router;