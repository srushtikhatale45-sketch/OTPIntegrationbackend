const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateTokens, setTokenCookies, clearTokenCookies } = require('../config/jwt');
const Admin = require('../models/Admin');
const User = require('../models/User');
const OTPRequest = require('../models/OTPRequest');
const BillingRecord = require('../models/BillingRecord');
const ActivityLog = require('../models/ActivityLog');
const { sendOTPviaSMS } = require('../services/otp/smsService');
const { sendWhatsAppOTPWithFallback } = require('../services/otp/whatsappService');
const { sendOTPviaEmail } = require('../services/otp/emailService');

const PRICES = {
  sms: 0.03,
  whatsapp: 0.02,
  email: 0.005
};

const generateOTPCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// -------------------- Admin Login (cookie based) --------------------
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ where: { email } });
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const { accessToken, refreshToken } = generateTokens(admin, 'admin');
    setTokenCookies(res, accessToken, refreshToken);
    // Optionally store refreshToken in database (AuthSession)
    res.json({
      success: true,
      role: 'admin',
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// -------------------- User OTP send (for end customers) --------------------
// This endpoint does NOT set cookies – it only sends OTP.
const userLogin = async (req, res) => {
  try {
    const { identifier, channel } = req.body;
    const user = await User.findOne({
      where: { [Op.or]: [{ email: identifier }, { phone: identifier }] }
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account inactive' });

    const price = PRICES[channel];
    if (parseFloat(user.balance) < price) {
      return res.status(402).json({ success: false, message: 'Insufficient balance', balance: user.balance });
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
    if (channel === 'sms') deliveryResult = await sendOTPviaSMS(user.phone, otpCode);
    else if (channel === 'whatsapp') deliveryResult = await sendWhatsAppOTPWithFallback(user.phone, otpCode);
    else deliveryResult = await sendOTPviaEmail(user.email, otpCode);

    if (deliveryResult.success) {
      await otpRequest.update({ status: 'sent' });
      const newBalance = parseFloat(user.balance) - price;
      await user.update({ balance: newBalance });
      await BillingRecord.create({
        userId: user.id,
        type: 'debit',
        amount: price,
        description: `OTP via ${channel}`,
        otpRequestId: otpRequest.id
      });
      await ActivityLog.create({
        userId: user.id,
        action: 'otp_sent',
        details: { channel, identifier }
      });
      return res.json({
        success: true,
        message: `OTP sent via ${channel}`,
        requestId: otpRequest.id,
        channel
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

// -------------------- Verify OTP (for end customers) --------------------
const verifyOTP = async (req, res) => {
  try {
    const { requestId, otpCode } = req.body;
    const otpRequest = await OTPRequest.findOne({
      where: { id: requestId, status: 'sent', expiresAt: { [Op.gt]: new Date() } }
    });
    if (!otpRequest) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
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
    // Do NOT return a token – this is for end customers only.
    res.json({
      success: true,
      verified: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
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

// -------------------- Resend OTP --------------------
const resendOTP = async (req, res) => {
  // ... implement similarly to userLogin but for resend
  res.status(501).json({ success: false, message: 'Not implemented' });
};

// -------------------- Get user info (protected) --------------------
const getUserInfo = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'phone', 'company', 'balance', 'services', 'isActive']
    });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// -------------------- Unified Dashboard Login (cookie based) --------------------
const unifiedLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    // Check Admin
    let admin = await Admin.findOne({ where: { email: identifier } });
    if (admin) {
      const isValid = await admin.comparePassword(password);
      if (isValid) {
        const { accessToken, refreshToken } = generateTokens(admin, 'admin');
        setTokenCookies(res, accessToken, refreshToken);
        return res.json({
          success: true,
          role: 'admin',
          admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
        });
      }
    }
    // Check User
    const user = await User.findOne({
      where: { [Op.or]: [{ email: identifier }, { phone: identifier }] }
    });
    if (user) {
      if (!user.isActive) return res.status(403).json({ success: false, message: 'Account inactive' });
      const isValid = await user.comparePassword(password);
      if (isValid) {
        const { accessToken, refreshToken } = generateTokens(user, 'user');
        setTokenCookies(res, accessToken, refreshToken);
        return res.json({
          success: true,
          role: 'user',
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            company: user.company,
            balance: user.balance,
            services: user.services
          }
        });
      }
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (error) {
    console.error('Unified login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// -------------------- Refresh Access Token --------------------
const refreshAccessToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ success: false, message: 'No refresh token' });
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    // Find user or admin
    let user;
    if (decoded.type === 'admin') {
      user = await Admin.findByPk(decoded.id);
      if (!user) return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    } else {
      user = await User.findByPk(decoded.id);
      if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email, type: decoded.type },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '15m' }
    );
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });
    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

// -------------------- Logout --------------------
const logout = (req, res) => {
  clearTokenCookies(res);
  res.json({ success: true, message: 'Logged out' });
};

module.exports = {
  adminLogin,
  userLogin,
  verifyOTP,
  resendOTP,
  getUserInfo,
  unifiedLogin,
  refreshAccessToken,
  logout
};