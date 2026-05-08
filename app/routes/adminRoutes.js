const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const {
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
  updateUserServices
} = require('../controllers/adminController');

// Public route
router.post('/login', adminLimiter, adminLogin);

// Protected routes
router.use(authenticateAdmin);

router.get('/dashboard/stats', getDashboardStats);
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/balance', addBalance);
router.post('/users/:id/payment', addUserPayment);
router.put('/users/:id/services', updateUserServices);
router.get('/otp-requests', getOTPRequests);
router.get('/activity-logs', getActivityLogs);
router.get('/billing-summary', getBillingSummary);
router.get('/services', getServices);

module.exports = router;