const crypto = require('crypto');

const generateOTP = (length = 6) => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateApiKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = { generateOTP, generateApiKey };