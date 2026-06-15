const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const userController = require('../controllers/userController');   // ← add this line

// Existing routes
router.get('/profile', authenticateUser, userController.getProfile);
router.get('/campaigns', authenticateUser, userController.getCampaigns);
router.post('/campaigns', authenticateUser, userController.createCampaign);
router.get('/messages', authenticateUser, userController.getMessages);
router.get('/report', authenticateUser, userController.getUserReport);
router.get('/enduser-dashboard', authenticateUser, userController.getEndUserDashboard);

// New customer routes
router.get('/customers', authenticateUser, userController.getCustomers);
router.post('/customers', authenticateUser, userController.createCustomer);
router.put('/customers/:id', authenticateUser, userController.updateCustomer);
router.delete('/customers/:id', authenticateUser, userController.deleteCustomer);

module.exports = router;