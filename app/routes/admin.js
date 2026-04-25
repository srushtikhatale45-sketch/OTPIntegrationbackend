const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');
const {
  adminLogin, getDashboardStats, getUsers, createUser, updateUser, deleteUser,
  addBalance, getOTPRequests, getActivityLogs, getBillingSummary
} = require('../controllers/adminController');

router.post('/login', adminLogin);
router.use(authenticateAdmin);
router.get('/dashboard/stats', getDashboardStats);
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/balance', addBalance);
router.get('/otp-requests', getOTPRequests);
router.get('/activity-logs', getActivityLogs);
router.get('/billing-summary', getBillingSummary);

module.exports = router;