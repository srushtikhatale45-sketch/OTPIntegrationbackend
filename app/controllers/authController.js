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

// Updated prices to Indian Rupees (INR)
const PRICES = {
  sms: 1.00,      // ₹1.00 per SMS OTP
  whatsapp: 0.50,  // ₹0.50 per WhatsApp OTP
  email: 0.25      // ₹0.25 per Email OTP
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
    res.json({ success: true, role: 'admin', admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// -------------------- User OTP send (for end customers AND end users) --------------------
const userLogin = async (req, res) => {
  try {
    const { identifier, channel, name } = req.body;
    let user = await User.findOne({
      where: { [Op.or]: [{ email: identifier }, { phone: identifier }] }
    });
    if (!user) {
      let emailValue = null, phoneValue = null, nameValue = name || '';
      if (identifier.includes('@')) {
        emailValue = identifier;
        if (!nameValue) nameValue = identifier.split('@')[0];
      } else {
        phoneValue = identifier;
        if (!nameValue) nameValue = identifier.slice(0, 10);
        emailValue = `user_${Date.now()}@temp.otp.com`;
      }
      user = await User.create({
        name: nameValue,
        email: emailValue,
        phone: phoneValue,
        password: Math.random().toString(36).slice(-8),
        type: 'end_user',
        balance: 0,
        services: { sms: true, whatsapp: true, email: true }
      });
    }
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account inactive' });

    const isClientAdmin = user.type === 'client_admin';
    const price = PRICES[channel];
    if (isClientAdmin && parseFloat(user.balance) < price) {
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
      cost: isClientAdmin ? price : 0,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    let deliveryResult;
    if (channel === 'sms') deliveryResult = await sendOTPviaSMS(identifier, otpCode);
    else if (channel === 'whatsapp') deliveryResult = await sendWhatsAppOTPWithFallback(identifier, otpCode);
    else deliveryResult = await sendOTPviaEmail(identifier, otpCode);

    if (deliveryResult.success) {
      await otpRequest.update({ status: 'sent' });
      if (isClientAdmin) {
        const newBalance = parseFloat(user.balance) - price;
        await user.update({ balance: newBalance });
        await BillingRecord.create({
          userId: user.id,
          type: 'debit',
          amount: price,
          description: `OTP via ${channel}`,
          otpRequestId: otpRequest.id
        });
      }
      await ActivityLog.create({
        userId: user.id,
        action: 'otp_sent',
        details: { channel, identifier, userType: user.type }
      });
      return res.json({
        success: true,
        message: `OTP sent via ${channel}`,
        requestId: otpRequest.id,
        channel,
        userType: user.type
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

// -------------------- Verify OTP (sets cookie) 
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
    if (!user) return res.status(500).json({ success: false, message: 'User not found' });

    // Generate token and set cookie (optional for dashboard)
    const tokenType = user.type === 'client_admin' ? 'user' : 'end_user';
    const { accessToken, refreshToken } = generateTokens(user, tokenType);
    setTokenCookies(res, accessToken, refreshToken);

    // Return userType explicitly
    res.json({
      success: true,
      verified: true,
      userType: user.type,
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
const resendOTP = async (req, res) => { res.status(501).json({ success: false, message: 'Not implemented' }); };

// -------------------- Get user info --------------------
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

// -------------------- Unified Dashboard Login (email+password) --------------------
const unifiedLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    let admin = await Admin.findOne({ where: { email: identifier } });
    if (admin) {
      const isValid = await admin.comparePassword(password);
      if (isValid) {
        const { accessToken, refreshToken } = generateTokens(admin, 'admin');
        setTokenCookies(res, accessToken, refreshToken);
        return res.json({ success: true, role: 'admin', admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
      }
    }
    const user = await User.findOne({ where: { [Op.or]: [{ email: identifier }, { phone: identifier }] } });
    if (user) {
      if (!user.isActive) return res.status(403).json({ success: false, message: 'Account inactive' });
      const isValid = await user.comparePassword(password);
      if (isValid) {
        const { accessToken, refreshToken } = generateTokens(user, 'user');
        setTokenCookies(res, accessToken, refreshToken);
        return res.json({ success: true, role: 'user', user: { id: user.id, name: user.name, email: user.email, phone: user.phone, company: user.company, balance: user.balance, services: user.services } });
      }
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (error) {
    console.error('Unified login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// -------------------- Refresh --------------------
const refreshAccessToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ success: false, message: 'No refresh token' });
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
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
    res.cookie('accessToken', newAccessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 15 * 60 * 1000 });
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