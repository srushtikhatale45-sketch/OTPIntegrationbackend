const express = require('express');
const router = express.Router();
const { sendOTPToCustomer, verifyCustomerOTP } = require('../controllers/publicController');

router.post('/send', sendOTPToCustomer);
router.post('/verify', verifyCustomerOTP);

module.exports = router;