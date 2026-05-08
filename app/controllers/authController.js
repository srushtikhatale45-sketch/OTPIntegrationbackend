const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const User = require('../models/User');
const OTPRequest = require('../models/OTPRequest');
const BillingRecord = require('../models/BillingRecord');
const ActivityLog = require('../models/ActivityLog');
const { generateToken } = require('../config/jwt');

// Import services
const { sendOTPviaSMS } = require('../services/otp/smsService');
const { sendOTPviaWhatsApp } = require('../services/otp/whatsappService');
const { sendOTPviaEmail } = require('../services/otp/emailService');

const PRICES = {
  sms: 0.03,
  whatsapp: 0.02,
  email: 0.005
};

const generateOTPCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// ==================== ADMIN LOGIN ====================
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Admin login attempt:', email);

    const admin = await Admin.findOne({ where: { email } });
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(admin, 'admin');
    res.json({ 
      success: true, 
      token, 
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } 
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== USER LOGIN - SEND OTP ====================
const userLogin = async (req, res) => {
  try {
    const { identifier, channel } = req.body;
    console.log('📱 User login request:', { identifier, channel });

    const user = await User.findOne({
      where: { [require('sequelize').Op.or]: [{ email: identifier }, { phone: identifier }] }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found. Please contact admin.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is inactive. Please contact admin.' });
    }

    const price = PRICES[channel];
    if (parseFloat(user.balance) < price) {
      return res.status(402).json({ 
        success: false, 
        message: 'Insufficient balance', 
        balance: user.balance,
        required: price
      });
    }

    const otpCode = generateOTPCode();
    const expiresAt = new Date(Date.now() + 5 * 60000);

    const otpRequest = await OTPRequest.create({
      userId: user.id,
      identifier,
      channel,
      otpCode,
      status: 'pending',
      cost: price,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    let deliveryResult;
    if (channel === 'sms') {
      deliveryResult = await sendOTPviaSMS(user.phone, otpCode);
    } else if (channel === 'whatsapp') {
      deliveryResult = await sendOTPviaWhatsApp(user.phone, otpCode);
    } else {
      deliveryResult = await sendOTPviaEmail(user.email, otpCode);
    }

    if (deliveryResult.success) {
      await otpRequest.update({ status: 'sent' });
      
      const newBalance = parseFloat(user.balance) - price;
      await user.update({ balance: newBalance });
      
      await BillingRecord.create({
        userId: user.id,
        type: 'debit',
        amount: price,
        description: `OTP request via ${channel}`,
        otpRequestId: otpRequest.id
      });

      await ActivityLog.create({
        userId: user.id,
        action: 'otp_sent',
        details: { channel, identifier },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        message: `OTP sent via ${channel}`,
        requestId: otpRequest.id,
        channel,
        expiresAt
      });
    } else {
      await otpRequest.update({ status: 'failed' });
      return res.status(500).json({ success: false, message: deliveryResult.error || 'Failed to send OTP' });
    }
  } catch (error) {
    console.error('User login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== VERIFY OTP ====================
const verifyOTP = async (req, res) => {
  try {
    const { requestId, otpCode } = req.body;
    console.log('🔐 Verifying OTP:', { requestId, otpCode });

    const otpRequest = await OTPRequest.findOne({
      where: { id: requestId, status: 'sent', expiresAt: { [require('sequelize').Op.gt]: new Date() } }
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
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    await otpRequest.update({ isVerified: true, status: 'verified' });

    const user = await User.findByPk(otpRequest.userId);
    const token = generateToken(user, 'user');

    await ActivityLog.create({
      userId: user.id,
      action: 'otp_verified',
      details: { channel: otpRequest.channel },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      verified: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        company: user.company,
        balance: user.balance,
        services: user.services
      },
      channel: otpRequest.channel,
      otp_cost: parseFloat(otpRequest.cost)
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== RESEND OTP ====================
const resendOTP = async (req, res) => {
  try {
    const { identifier, channel } = req.body;
    console.log('🔄 Resend OTP request:', { identifier, channel });

    const user = await User.findOne({
      where: { [require('sequelize').Op.or]: [{ email: identifier }, { phone: identifier }] }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const price = PRICES[channel];
    if (parseFloat(user.balance) < price) {
      return res.status(402).json({ 
        success: false, 
        message: 'Insufficient balance', 
        balance: user.balance 
      });
    }

    const otpCode = generateOTPCode();
    const expiresAt = new Date(Date.now() + 5 * 60000);

    await OTPRequest.destroy({ where: { userId: user.id, isVerified: false } });

    const otpRequest = await OTPRequest.create({
      userId: user.id,
      identifier,
      channel,
      otpCode,
      status: 'pending',
      cost: price,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    let deliveryResult;
    if (channel === 'sms') {
      deliveryResult = await sendOTPviaSMS(user.phone, otpCode);
    } else if (channel === 'whatsapp') {
      deliveryResult = await sendOTPviaWhatsApp(user.phone, otpCode);
    } else {
      deliveryResult = await sendOTPviaEmail(user.email, otpCode);
    }

    if (deliveryResult.success) {
      await otpRequest.update({ status: 'sent' });
      
      const newBalance = parseFloat(user.balance) - price;
      await user.update({ balance: newBalance });
      
      await BillingRecord.create({
        userId: user.id,
        type: 'debit',
        amount: price,
        description: `Resend OTP via ${channel}`,
        otpRequestId: otpRequest.id
      });

      return res.json({
        success: true,
        message: `OTP resent via ${channel}`,
        requestId: otpRequest.id,
        channel
      });
    } else {
      await otpRequest.update({ status: 'failed' });
      return res.status(500).json({ success: false, message: deliveryResult.error });
    }
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET USER INFO ====================
const getUserInfo = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'phone', 'company', 'balance', 'services', 'isActive']
    });
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== EXPORT ALL FUNCTIONS ====================
module.exports = { 
  adminLogin, 
  userLogin, 
  verifyOTP, 
  resendOTP, 
  getUserInfo 
};