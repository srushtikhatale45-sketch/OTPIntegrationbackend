const { Op } = require('sequelize');
const User = require('../models/User');
const OTPRequest = require('../models/OTPRequest');
const AuthSession = require('../models/AuthSession');
const BillingRecord = require('../models/BillingRecord');
const ActivityLog = require('../models/ActivityLog');
const { generateOTP } = require('../services/otp/otpGenerator');
const { sendSMSOTP } = require('../services/otp/smsService');
const { sendWhatsAppOTPWithFallback } = require('../services/otp/whatsappService');
const { sendEmailOTP } = require('../services/otp/emailService');
const { generateToken } = require('../config/jwt');

const PRICES = {
  sms: parseFloat(process.env.PRICE_SMS) || 0.03,
  whatsapp: parseFloat(process.env.PRICE_WHATSAPP) || 0.02,
  email: parseFloat(process.env.PRICE_EMAIL) || 0.005
};

// Send OTP
const sendOTP = async (req, res) => {
  try {
    const { identifier, channel } = req.body;
    const user = await User.findOne({
      where: { [Op.or]: [{ email: identifier }, { phone: identifier }] }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is inactive' });
    }

    const price = PRICES[channel];
    if (parseFloat(user.balance) < price) {
      return res.status(402).json({ success: false, message: 'Insufficient balance', balance: user.balance });
    }

    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRE_MINUTES || 5) * 60000);

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
    if (channel === 'sms' && user.phone) {
      deliveryResult = await sendSMSOTP(user.phone, otpCode);
    } else if (channel === 'whatsapp' && user.phone) {
  deliveryResult = await sendWhatsAppOTPWithFallback(user.phone, otpCode);
} else if (channel === 'email' && user.email) {
      deliveryResult = await sendEmailOTP(user.email, otpCode);
    } else {
      deliveryResult = { success: false, error: 'Invalid channel or missing contact info' };
    }

    if (deliveryResult.success) {
      await otpRequest.update({ status: 'sent' });
      
      // Deduct balance
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
      return res.status(500).json({ success: false, message: deliveryResult.error });
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { requestId, otpCode } = req.body;

    const otpRequest = await OTPRequest.findOne({
      where: { id: requestId, status: 'sent', expiresAt: { [Op.gt]: new Date() } }
    });

    if (!otpRequest) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    if (otpRequest.attempts >= (process.env.MAX_OTP_ATTEMPTS || 3)) {
      await otpRequest.update({ status: 'failed' });
      return res.status(400).json({ success: false, message: 'Too many attempts' });
    }

    if (otpRequest.otpCode !== otpCode) {
      await otpRequest.update({ attempts: otpRequest.attempts + 1 });
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    await otpRequest.update({ isVerified: true, status: 'verified' });

    const user = await User.findByPk(otpRequest.userId, {
      attributes: ['id', 'name', 'email', 'phone', 'company', 'balance', 'isActive', 'createdAt']
    });
    
    const token = generateToken(user, 'user');
    const loginTime = new Date();

    await AuthSession.create({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    await ActivityLog.create({
      userId: user.id,
      action: 'otp_verified',
      details: { channel: otpRequest.channel },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Return full user object for frontend
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
        isActive: user.isActive,
        createdAt: user.createdAt
      },
      channel: otpRequest.channel,
      login_time: loginTime,
      otp_cost: parseFloat(otpRequest.cost),
      message_status: 'delivered'
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
      attributes: ['id', 'name', 'email', 'phone', 'company', 'balance', 'isActive']
    });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { sendOTP, verifyOTP, getUserInfo };