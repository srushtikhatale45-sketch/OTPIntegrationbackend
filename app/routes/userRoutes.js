const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const { 
  getProfile, 
  getCampaigns, 
  createCampaign, 
  getMessages, 
  getUserReport 
} = require('../controllers/userController');

router.use(authenticateUser);

router.get('/profile', getProfile);
router.get('/campaigns', getCampaigns);
router.post('/campaigns', createCampaign);
router.get('/messages', getMessages);
router.get('/report', getUserReport);

module.exports = router;