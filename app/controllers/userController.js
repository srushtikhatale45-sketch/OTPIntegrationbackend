const db = require('../models');
const { sendSMSOTP } = require('../services/otp/smsService');
const { sendWhatsAppOTPWithFallback } = require('../services/otp/whatsappService');
const { sendEmailOTP } = require('../services/otp/emailService');

const Campaign = db.Campaign;
const Message = db.Message;
const Payment = db.Payment;
const User = db.User;
const OTPRequest = db.OTPRequest;
const BillingRecord = db.BillingRecord;
// Updated prices to Indian Rupees (INR)
const PRICES = {
  sms: 1.00,      // ₹1.00 per SMS OTP
  whatsapp: 0.50,  // ₹0.50 per WhatsApp OTP
  email: 0.25      // ₹0.25 per Email OTP
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'phone', 'company', 'balance', 'services', 'apiKey', 'createdAt']
    });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user campaigns
const getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json({ success: true, campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createCampaign = async (req, res) => {
  try {
    const { name, message, channel, recipients } = req.body;
    const user = await User.findByPk(req.user.id);
    
    const price = PRICES[channel];
    const totalCost = price * recipients.length;
    
    if (parseFloat(user.balance) < totalCost) {
      return res.status(402).json({ 
        success: false, 
        message: `Insufficient balance. Need ₹${totalCost.toFixed(4)}, have ₹${parseFloat(user.balance).toFixed(2)}` 
      });
    }
    
    // Create campaign
    const campaign = await Campaign.create({
      userId: req.user.id,
      name,
      message,
      channel,
      recipients,
      status: 'processing'
    });
    
    // Deduct balance
    const newBalance = parseFloat(user.balance) - totalCost;
    await user.update({ balance: newBalance });
    
    // Create BillingRecord for the campaign (debit)
    await BillingRecord.create({
      userId: req.user.id,
      type: 'debit',
      amount: totalCost,
      description: `Campaign "${name}" via ${channel}`,
      campaignId: campaign.id
    });
    
    // Create individual messages and send (existing code)
    let successCount = 0;
    let failedCount = 0;
    
    for (const recipient of recipients) {
      let deliveryResult;
      if (channel === 'sms') deliveryResult = await sendSMSOTP(recipient, 'OTP');
      else if (channel === 'whatsapp') deliveryResult = await sendWhatsAppOTPWithFallback(recipient, 'OTP');
      else deliveryResult = await sendEmailOTP(recipient, 'OTP');
      
      const status = deliveryResult.success ? 'delivered' : 'failed';
      if (deliveryResult.success) successCount++; else failedCount++;
      
      await Message.create({
        userId: req.user.id,
        campaignId: campaign.id,
        recipient,
        channel,
        content: message,
        status,
        cost: price
      });
    }
    
    await campaign.update({ 
      status: 'completed', 
      successCount, 
      failedCount, 
      totalCost 
    });
    
    res.json({ success: true, campaign });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user messages
const getMessages = async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: { userId: req.user.id },
      include: [{ model: Campaign, as: 'campaign', attributes: ['name'] }],
      order: [['createdAt', 'DESC']],
      limit: 100
    });
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user report
const getUserReport = async (req, res) => {
  try {
    const totalMessages = await Message.count({ where: { userId: req.user.id } });
    const successful = await Message.count({ where: { userId: req.user.id, status: 'delivered' } });
    const failed = await Message.count({ where: { userId: req.user.id, status: 'failed' } });
    const totalSpent = await Message.sum('cost', { where: { userId: req.user.id } });
    const payments = await Payment.findAll({ 
      where: { userId: req.user.id }, 
      order: [['createdAt', 'DESC']] 
    });
    
    res.json({ 
      success: true, 
      report: { totalMessages, successful, failed, totalSpent: totalSpent || 0, payments } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getEndUserDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'phone', 'type']
    });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  
};
// Get all customers for the logged-in client admin
const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.findAll({ where: { userId: req.user.id } });
    res.json({ success: true, customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new customer
const createCustomer = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const customer = await Customer.create({
      userId: req.user.id,
      name,
      email,
      phone
    });
    res.json({ success: true, customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update customer
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;
    const customer = await Customer.findOne({ where: { id, userId: req.user.id } });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    await customer.update({ name, email, phone });
    res.json({ success: true, customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete customer
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOne({ where: { id, userId: req.user.id } });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    await customer.destroy();
    res.json({ success: true, message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
module.exports = { getProfile, getCampaigns, createCampaign, getMessages, getUserReport , getEndUserDashboard, createCustomer, getCustomers, updateCustomer, deleteCustomer };