const { Op } = require('sequelize');
const User = require('../models/User');
const Customer = require('../models/Customer');
const OTPRequest = require('../models/OTPRequest');
const BillingRecord = require('../models/BillingRecord');
const { sendOTPviaSMS } = require('../services/otp/smsService');
const { sendWhatsAppOTPWithFallback } = require('../services/otp/whatsappService');
const { sendOTPviaEmail } = require('../services/otp/emailService');

const PRICES = {
  sms: 1.00,
  whatsapp: 0.50,
  email: 0.25
};

const generateOTPCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// Public endpoint: send OTP to a customer (visitor) using client admin's apiKey
const sendOTPToCustomer = async (req, res) => {
  try {
    const { apiKey, identifier, channel, name } = req.body;
    
    if (!apiKey || !identifier || !channel) {
      return res.status(400).json({ success: false, message: 'apiKey, identifier and channel are required' });
    }
    
    // Find client admin by apiKey
    const clientAdmin = await User.findOne({ where: { apiKey, type: 'client_admin' } });
    if (!clientAdmin) {
      return res.status(401).json({ success: false, message: 'Invalid API key' });
    }
    
    // Check balance
    const price = PRICES[channel];
    if (parseFloat(clientAdmin.balance) < price) {
      return res.status(402).json({ success: false, message: 'Insufficient balance', balance: clientAdmin.balance });
    }
    
    // Find or create customer under this client admin
    let customer = await Customer.findOne({
      where: { userId: clientAdmin.id, [Op.or]: [{ email: identifier }, { phone: identifier }] }
    });
    if (!customer) {
      customer = await Customer.create({
        userId: clientAdmin.id,
        name: name || (identifier.includes('@') ? identifier.split('@')[0] : identifier.slice(0, 10)),
        email: identifier.includes('@') ? identifier : null,
        phone: !identifier.includes('@') ? identifier : null
      });
    }
    
    // Generate OTP
    const otpCode = generateOTPCode();
    const expiresAt = new Date(Date.now() + 5 * 60000);
    
    const otpRequest = await OTPRequest.create({
      userId: clientAdmin.id,
      customerId: customer.id,
      identifier,
      channel,
      otpCode,
      status: 'pending',
      cost: price,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // Send OTP
    let deliveryResult;
    if (channel === 'sms') deliveryResult = await sendOTPviaSMS(identifier, otpCode);
    else if (channel === 'whatsapp') deliveryResult = await sendWhatsAppOTPWithFallback(identifier, otpCode);
    else deliveryResult = await sendOTPviaEmail(identifier, otpCode);
    
    if (deliveryResult.success) {
      await otpRequest.update({ status: 'sent' });
      // Deduct balance and create billing record
      const newBalance = parseFloat(clientAdmin.balance) - price;
      await clientAdmin.update({ balance: newBalance });
      await BillingRecord.create({
        userId: clientAdmin.id,
        customerId: customer.id,
        type: 'debit',
        amount: price,
        description: `OTP via ${channel} for customer ${customer.name}`
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
    console.error('Public send OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Public endpoint: verify OTP (no apiKey needed, only requestId and otpCode)
const verifyCustomerOTP = async (req, res) => {
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
    res.json({ success: true, verified: true });
  } catch (error) {
    console.error('Public verify OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { sendOTPToCustomer, verifyCustomerOTP };