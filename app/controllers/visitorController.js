const { Op } = require('sequelize');
const Visitor = require('../models/Visitor');
const VisitorOTP = require('../models/VisitorOTP');
const { sendOTPviaSMS } = require('../services/otp/smsService');
const { sendWhatsAppOTPWithFallback } = require('../services/otp/whatsappService');
const { sendOTPviaEmail } = require('../services/otp/emailService');
const jwt = require('jsonwebtoken');

const generateOTPCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP to visitor (free, no billing)
const sendOTP = async (req, res) => {
  try {
    const { identifier, channel } = req.body;
    if (!identifier || !channel) {
      return res.status(400).json({ success: false, message: 'Identifier and channel required' });
    }
    // Find or create visitor
    let visitor = await Visitor.findOne({ where: { identifier } });
    if (!visitor) {
      visitor = await Visitor.create({ identifier });
    }
    const otpCode = generateOTPCode();
    const expiresAt = new Date(Date.now() + 5 * 60000);
    const otpRequest = await VisitorOTP.create({
      visitorId: visitor.id,
      identifier,
      channel,
      otpCode,
      expiresAt
    });
    let deliveryResult;
    if (channel === 'sms') deliveryResult = await sendOTPviaSMS(identifier, otpCode);
    else if (channel === 'whatsapp') deliveryResult = await sendWhatsAppOTPWithFallback(identifier, otpCode);
    else deliveryResult = await sendOTPviaEmail(identifier, otpCode);
    if (deliveryResult.success) {
      await otpRequest.update({ status: 'sent' });
      return res.json({ success: true, message: `OTP sent via ${channel}`, requestId: otpRequest.id, channel });
    } else {
      await otpRequest.update({ status: 'failed' });
      return res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
  } catch (error) {
    console.error('Visitor send OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify OTP for visitor
const verifyOTP = async (req, res) => {
  try {
    const { requestId, otpCode } = req.body;
    const otpRequest = await VisitorOTP.findOne({
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
    const visitor = await Visitor.findByPk(otpRequest.visitorId);
    const token = jwt.sign(
      { id: visitor.id, type: 'visitor' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      success: true,
      verified: true,
      token,
      visitor: { id: visitor.id, identifier: visitor.identifier }
    });
  } catch (error) {
    console.error('Visitor verify OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get visitor dashboard data (their OTP history)
const getVisitorDashboard = async (req, res) => {
  try {
    const visitorId = req.visitor.id;
    const otpHistory = await VisitorOTP.findAll({
      where: { visitorId },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    const stats = {
      total: otpHistory.length,
      verified: otpHistory.filter(o => o.isVerified).length,
      failed: otpHistory.filter(o => o.status === 'failed').length
    };
    res.json({ success: true, visitor: req.visitor, otpHistory, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { sendOTP, verifyOTP, getVisitorDashboard };