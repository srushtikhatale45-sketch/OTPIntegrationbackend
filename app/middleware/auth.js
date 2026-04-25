const { verifyToken } = require('../config/jwt');
const User = require('../models/User');
const Admin = require('../models/Admin');

const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token required' });

    const decoded = verifyToken(token);
    if (!decoded || decoded.type !== 'user') return res.status(403).json({ success: false, message: 'Invalid token' });

    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'User not found or inactive' });

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token required' });

    const decoded = verifyToken(token);
    if (!decoded || decoded.type !== 'admin') return res.status(403).json({ success: false, message: 'Invalid token' });

    const admin = await Admin.findByPk(decoded.id);
    if (!admin) return res.status(401).json({ success: false, message: 'Admin not found' });

    req.admin = admin;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { authenticateUser, authenticateAdmin };