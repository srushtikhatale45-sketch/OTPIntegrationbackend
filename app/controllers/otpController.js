const { Op } = require('sequelize');
const User = require('../models/User');
const OTPRequest = require('../models/OTPRequest');

const PRICES = {
  sms: 0.03,
  whatsapp: 0.02,
  email: 0.005
};

const sendOTP = async (req, res) => {
  try {
    const { phoneNumber, channel } = req.body;
    console.log('📱 Send OTP request:', { phoneNumber, channel });

    if (!phoneNumber || !channel) {
      return res.status(400).json({ success: false, message: 'Phone number and channel are required' });
    }

    // Find user by phone number
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { phone: phoneNumber },
          { mobileNumber: phoneNumber }
        ]
      }
    });

    if (!user) {
      console.error(`User not found with phone: ${phoneNumber}`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('Found user:', {
      id: user.id,
      email: user.email,
      phone: user.phone,
      balance: user.balance
    });

    // Validate user.id is a valid UUID
    if (!user.id) {
      console.error('User id is missing or invalid');
      return res.status(500).json({ success: false, message: 'User record corrupted' });
    }

    // Check balance
    const price = PRICES[channel] || 0.03;
    const currentBalance = parseFloat(user.balance) || 0;
    if (currentBalance < price) {
      return res.status(402).json({
        success: false,
        message: 'Insufficient balance',
        balance: currentBalance,
        required: price
      });
    }

    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000);

    // Create OTP request - ensure userId is a string (UUID)
    const otpRequestData = {
      userId: user.id, // should be UUID string
      identifier: phoneNumber,
      channel: channel,
      otpCode: otpCode,
      status: 'pending',
      cost: price,
      expiresAt: expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };

    console.log('Creating OTP request with data:', { ...otpRequestData, otpCode: '***' });

    const otpRequest = await OTPRequest.create(otpRequestData);

    // Deduct balance
    const newBalance = currentBalance - price;
    await user.update({ balance: newBalance });

    console.log(`✅ OTP created for ${phoneNumber} with requestId: ${otpRequest.id}`);

    res.json({
      success: true,
      message: `OTP sent via ${channel}`,
      requestId: otpRequest.id,
      channel: channel,
      devOtp: process.env.NODE_ENV !== 'production' ? otpCode : undefined
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    // Check if foreign key violation
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(500).json({ success: false, message: 'User reference error. Please contact support.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};


// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { requestId, otpCode } = req.body;
    console.log('🔐 Verify OTP:', { requestId, otpCode });

    const otpRequest = await OTPRequest.findOne({
      where: { id: requestId, status: 'pending', expiresAt: { [Op.gt]: new Date() } }
    });

    if (!otpRequest) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    if (otpRequest.attempts >= 3) {
      await otpRequest.update({ status: 'failed' });
      return res.status(400).json({ success: false, message: 'Too many attempts' });
    }

    if (otpRequest.otpCode !== otpCode) {
      await otpRequest.update({ attempts: otpRequest.attempts + 1 });
      const remainingAttempts = 3 - otpRequest.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remainingAttempts} attempts remaining.`
      });
    }

    await otpRequest.update({ isVerified: true, status: 'verified' });

    const user = await User.findByPk(otpRequest.userId, {
      attributes: ['id', 'name', 'email', 'phone', 'mobileNumber', 'balance', 'isActive']
    });

    // Generate a token for the user (if you want to keep them logged in)
    const token = require('jsonwebtoken').sign(
      { id: user.id, email: user.email, type: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      success: true,
      verified: true,
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || user.mobileNumber,
        balance: user.balance
      },
      channel: otpRequest.channel,
      otp_cost: parseFloat(otpRequest.cost)
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user info
const getUserInfo = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'phone', 'mobileNumber', 'balance', 'isActive']
    });
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { sendOTP, verifyOTP, getUserInfo };