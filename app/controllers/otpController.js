const { Op } = require('sequelize');
const User = require('../models/User');
const OTPRequest = require('../models/OTPRequest');

// Send OTP
const sendOTP = async (req, res) => {
  try {
    const { phoneNumber, channel } = req.body;
    console.log('📱 Send OTP request:', { phoneNumber, channel });
    
    // Find user by phone number - check both possible field names
    const user = await User.findOne({ 
      where: { 
        [Op.or]: [
          { phone: phoneNumber },
          { mobileNumber: phoneNumber }
        ]
      } 
    });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000);
    
    // Save OTP request
    const otpRequest = await OTPRequest.create({
      userId: user.id,
      identifier: phoneNumber,
      channel: channel,
      otpCode: otpCode,
      status: 'pending',
      cost: 0.03,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    console.log(`✅ OTP generated for ${phoneNumber}: ${otpCode}`);
    
    res.json({
      success: true,
      message: `OTP sent via ${channel}`,
      requestId: otpRequest.id,
      channel: channel,
      devOtp: process.env.NODE_ENV !== 'production' ? otpCode : undefined
    });
  } catch (error) {
    console.error('Send OTP error:', error);
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
    
    res.json({
      success: true,
      verified: true,
      token: 'user-token-' + Date.now(),
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