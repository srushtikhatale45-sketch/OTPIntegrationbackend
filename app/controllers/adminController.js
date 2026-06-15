const { Op } = require('sequelize');
const db = require('../models');
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/jwt');

// Helper to get models
let User, OTPRequest, ActivityLog, BillingRecord, Payment, Campaign, Message;

try {
  User = db.User || require('../models/User');
  OTPRequest = db.OTPRequest || require('../models/OTPRequest');
  ActivityLog = db.ActivityLog || require('../models/ActivityLog');
  BillingRecord = db.BillingRecord || require('../models/BillingRecord');
  Payment = db.Payment || require('../models/Payment');
  Campaign = db.Campaign || require('../models/Campaign');
  Message = db.Message || require('../models/Message');
} catch (error) {
  console.log('Error loading models:', error.message);
}

// Admin Login
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ where: { email } });

    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(admin, 'admin');
    res.json({ success: true, token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Dashboard Stats
const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await (User?.count() || Promise.resolve(0));
    const activeUsers = await (User?.count({ where: { isActive: true } }) || Promise.resolve(0));
    const totalOTPRequests = await (OTPRequest?.count() || Promise.resolve(0));
    const successfulVerifications = await (OTPRequest?.count({ where: { status: 'verified' } }) || Promise.resolve(0));
    const failedAttempts = await (OTPRequest?.count({ where: { status: 'failed' } }) || Promise.resolve(0));
    
    let revenue = 0;
    let channelStats = [];
    
    if (BillingRecord) {
      revenue = await BillingRecord.sum('amount', { where: { type: 'debit' } }) || 0;
    }
    
    if (OTPRequest) {
      channelStats = await OTPRequest.findAll({
        attributes: ['channel', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
        group: ['channel']
      }) || [];
    }

    const adminBalance = await (Payment?.sum('amount', { where: { type: 'credit' } }) || Promise.resolve(0));
    
    const recentActivities = await (ActivityLog?.findAll({
      include: User ? [{ model: User, as: 'User', attributes: ['name', 'email'], required: false }] : [],
      order: [['createdAt', 'DESC']],
      limit: 10
    }) || Promise.resolve([]));

    res.json({
      success: true,
      stats: { 
        totalUsers, 
        activeUsers,
        totalOTPRequests, 
        successfulVerifications, 
        failedAttempts, 
        revenue: revenue || 0 
      },
      channelStats: channelStats || [],
      adminBalance: adminBalance || 0,
      recentActivities
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all users
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let where = { type: 'client_admin'};
    if (search) {
      where = {
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ]
      };
    }
    
    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: ['id', 'name', 'email', 'phone', 'company', 'balance', 'services', 'isActive', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      users: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get OTP statistics per user (total attempts, verified, failed, pending)
const getUserOTPStats = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'phone'],
      include: [{
        model: OTPRequest,
        as: 'otpRequests',
        attributes: ['status', 'isVerified', 'attempts']
      }]
    });

    const stats = users.map(user => {
      const otps = user.otpRequests || [];
      const total = otps.length;
      const verified = otps.filter(o => o.isVerified === true).length;
      const failed = otps.filter(o => o.status === 'failed' || (o.status !== 'verified' && o.attempts >= 3)).length;
      const pending = total - verified - failed;
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        totalAttempts: total,
        verifiedCount: verified,
        failedCount: failed,
        pendingCount: pending
      };
    });

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching user OTP stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, phone, company, password, services, initialBalance } = req.body;
    
    console.log('Create user request:', { name, email, phone, company, hasPassword: !!password, services, initialBalance });
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, and password are required' 
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      where: { 
        [Op.or]: [
          { email: email },
          { phone: phone }
        ] 
      } 
    });
    
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    
    // Create user with password
    const user = await User.create({
      name,
      email,
      phone: phone || null,
      company: company || null,
      password: password, // This will be hashed by the model hook
      services: services || { sms: true, whatsapp: false, email: true },
      balance: initialBalance || 0,
      isActive: true
    });
    
    // Remove password from response
    const userResponse = user.toJSON();
    delete userResponse.password;
    
    // Log activity
    await ActivityLog.create({
      userId: user.id,
      action: 'user_created',
      details: { createdBy: req.admin?.id || 'system' }
    });
    
    console.log('User created successfully:', user.id);
    
    res.json({ success: true, user: userResponse });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, company, isActive, services } = req.body;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    await user.update({ name, email, phone, company, isActive, services });
    
    await ActivityLog?.create({
      userId: id,
      action: 'user_updated',
      details: { updatedBy: req.admin?.id || 'system' }
    });
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    await user.destroy();
    
    await ActivityLog?.create({
      action: 'user_deleted',
      details: { deletedBy: req.admin?.id || 'system', userId: id }
    });
    
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add balance
const addBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description } = req.body;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const newBalance = parseFloat(user.balance) + parseFloat(amount);
    await user.update({ balance: newBalance });
    
    if (BillingRecord) {
      await BillingRecord.create({
        userId: id,
        type: 'credit',
        amount,
        description: description || `Admin added ₹${amount} credits`
      });
    }
    
    res.json({ success: true, balance: newBalance });
  } catch (error) {
    console.error('Add balance error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getOTPRequests = async (req, res) => {
  try {
    const { page = 1, limit = 50, channel, status, verified } = req.query;
    const where = {};
    if (channel && channel !== 'all') where.channel = channel;
    if (status && status !== 'all') where.status = status;
    if (verified !== undefined && verified !== 'all') {
      where.isVerified = verified === 'true';
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await OTPRequest.findAndCountAll({
      where,
      include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    res.json({ success: true, requests: rows, pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get activity logs
const getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let count = 0;
    let rows = [];
    
    if (ActivityLog) {
      const result = await ActivityLog.findAndCountAll({
        include: User ? [{ model: User, as: 'User', attributes: ['id', 'name', 'email'], required: false }] : [],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset
      });
      count = result.count;
      rows = result.rows;
    }
    
    res.json({
      success: true,
      logs: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get billing summary
const getBillingSummary = async (req, res) => {
  try {
    let totalRevenue = 0;
    let userCredits = 0;
    let channelRevenue = [];
    
    if (BillingRecord) {
      totalRevenue = await BillingRecord.sum('amount', { where: { type: 'debit' } }) || 0;
      userCredits = await BillingRecord.sum('amount', { where: { type: 'credit' } }) || 0;
    }
    
    if (OTPRequest) {
      channelRevenue = await OTPRequest.findAll({
        attributes: ['channel', [require('sequelize').fn('SUM', require('sequelize').col('cost')), 'total']],
        where: { status: 'verified' },
        group: ['channel']
      }) || [];
    }
    
    res.json({
      success: true,
      totalRevenue,
      userCredits,
      netRevenue: totalRevenue - userCredits,
      channelRevenue
    });
  } catch (error) {
    console.error('Get billing summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get services
const getServices = async (req, res) => {
  try {
    const services = [
      { id: 'sms', name: 'SMS', price: 1.00, icon: '📱', description: 'Text message OTP' },
      { id: 'whatsapp', name: 'WhatsApp', price: 0.50, icon: '💬', description: 'WhatsApp message OTP' },
      { id: 'email', name: 'Email', price: 0.25, icon: '✉️', description: 'Email OTP' }
    ];
    res.json({ success: true, services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add payment to user
const addUserPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description } = req.body;
    
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    const newBalance = parseFloat(user.balance) + parseFloat(amount);
    await user.update({ balance: newBalance });
    
    if (Payment) {
      await Payment.create({
        userId: id,
        amount,
        type: 'credit',
        description: description || `Admin added ₹${amount} credits`
      });
    }
    
    await ActivityLog?.create({
      userId: id,
      action: 'payment_added',
      details: { amount, description, addedBy: req.admin?.id }
    });
    
    res.json({ success: true, balance: newBalance });
  } catch (error) {
    console.error('Add user payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// Get user dashboard data for admin viewing
const getUserDashboardData = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'phone', 'company', 'balance', 'services', 'apiKey', 'createdAt']
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const campaigns = await Campaign.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    const messages = await Message.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 100
    });
    const totalMessages = await Message.count({ where: { userId } });
    const successful = await Message.count({ where: { userId, status: 'delivered' } });
    const failed = await Message.count({ where: { userId, status: 'failed' } });
    const totalSpent = await Message.sum('cost', { where: { userId } }) || 0;
    const payments = await Payment.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      user,
      campaigns,
      messages,
      report: { totalMessages, successful, failed, totalSpent, payments }
    });
  } catch (error) {
    console.error('Error fetching user dashboard data:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update user services
const updateUserServices = async (req, res) => {
  try {
    const { id } = req.params;
    const { services } = req.body;
    
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    await user.update({ services });
    res.json({ success: true, services: user.services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.findAll({
      include: [{ model: User, as: 'clientAdmin', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  adminLogin,
  getDashboardStats,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  addBalance,
  getOTPRequests,
  getActivityLogs,
  getBillingSummary,
  getServices,
  addUserPayment,
  updateUserServices,
  getUserOTPStats,
  getUserDashboardData,
  getCustomers
};