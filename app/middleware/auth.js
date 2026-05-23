const { verifyToken } = require('../config/jwt');
const User = require('../models/User');
const Admin = require('../models/Admin');

const authenticateUser = async (req, res, next) => {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json({ success: false, message: 'No token' });
  const decoded = verifyToken(token);
  if (!decoded) return res.status(403).json({ success: false, message: 'Invalid token' });
  if (decoded.type !== 'user') return res.status(403).json({ success: false, message: 'Not a user token' });
  const user = await User.findByPk(decoded.id);
  if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'User not found/inactive' });
  req.user = user;
  next();
};

const authenticateAdmin = async (req, res, next) => {
  const token = req.cookies.accessToken;   // Same cookie name
  if (!token) return res.status(401).json({ success: false, message: 'No token' });
  const decoded = verifyToken(token);
  if (!decoded) return res.status(403).json({ success: false, message: 'Invalid token' });
  if (decoded.type !== 'admin') return res.status(403).json({ success: false, message: 'Not an admin token' });
  const admin = await Admin.findByPk(decoded.id);
  if (!admin) return res.status(401).json({ success: false, message: 'Admin not found' });
  req.admin = admin;
  next();
};

module.exports = { authenticateUser, authenticateAdmin };