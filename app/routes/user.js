const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const db = require('../models');

// Get user profile
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'phone', 'company', 'balance', 'isActive', 'createdAt']
    });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user OTP requests
router.get('/otp-requests', authenticateUser, async (req, res) => {
  try {
    const requests = await db.OTPRequest.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user activity logs
router.get('/activities', authenticateUser, async (req, res) => {
  try {
    const activities = await db.ActivityLog.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json({ success: true, activities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;