const { Op } = require('sequelize');
const db = require('../models');
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/jwt');

// Helper to get models with fallback
let User, OTPRequest, ActivityLog, BillingRecord;

try {
  User = db.User || require('../models/User');
  OTPRequest = db.OTPRequest || require('../models/OTPRequest');
  ActivityLog = db.ActivityLog || require('../models/ActivityLog');
  BillingRecord = db.BillingRecord || require('../models/BillingRecord');
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

    res.json({
      success: true,
      stats: { 
        totalUsers, 
        totalOTPRequests, 
        successfulVerifications, 
        failedAttempts, 
        revenue: revenue || 0 
      },
      channelStats: channelStats || []
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
    
    let where = {};
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
      attributes: ['id', 'name', 'email', 'phone', 'company', 'balance', 'isActive', 'createdAt'],
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

// Create user
const createUser = async (req, res) => {
  try {
    const { name, email, phone, company, initialBalance } = req.body;
    
    const existingUser = await User.findOne({ where: { [Op.or]: [{ email }, { phone }] } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    
    const user = await User.create({
      name,
      email,
      phone,
      company,
      balance: initialBalance || 0,
      isActive: true
    });
    
    await ActivityLog?.create({
      userId: user.id,
      action: 'user_created',
      details: { createdBy: req.admin?.id || 'system' }
    });
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, company, isActive } = req.body;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    await user.update({ name, email, phone, company, isActive });
    
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
        description: description || `Admin added ₹${amount}`
      });
    }
    
    res.json({ success: true, balance: newBalance });
  } catch (error) {
    console.error('Add balance error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get OTP requests
const getOTPRequests = async (req, res) => {
  try {
    const { page = 1, limit = 50, channel, status } = req.query;
    const where = {};
    if (channel && channel !== 'all') where.channel = channel;
    if (status && status !== 'all') where.status = status;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let count = 0;
    let rows = [];
    
    if (OTPRequest) {
      const result = await OTPRequest.findAndCountAll({
        where,
        include: User ? [{ model: User, as: 'User', attributes: ['id', 'name', 'email', 'phone'], required: false }] : [],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset
      });
      count = result.count;
      rows = result.rows;
    }
    
    res.json({
      success: true,
      requests: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get OTP requests error:', error);
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
  getBillingSummary
};