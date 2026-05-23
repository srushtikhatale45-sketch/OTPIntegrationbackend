const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');

const db = {};

// Read all model files in this directory
const files = fs.readdirSync(__dirname).filter(file => {
  return (file.indexOf('.') !== 0) && 
         (file !== 'index.js') && 
         (file.slice(-3) === '.js');
});

// Import models
files.forEach(file => {
  try {
    const model = require(path.join(__dirname, file));
    const modelName = model.name || path.basename(file, '.js');
    db[modelName] = model;
    console.log(`✅ Loaded model: ${modelName}`);
  } catch (error) {
    console.error(`❌ Failed to load model ${file}:`, error.message);
  }
});

// Debug: Log what models are available
console.log('Available models:', Object.keys(db));

// Define associations only if models are valid and have the required methods
if (db.User && typeof db.User.hasMany === 'function') {
  console.log('Setting up associations for User...');
  
  if (db.ActivityLog && typeof db.ActivityLog.belongsTo === 'function') {
    db.User.hasMany(db.ActivityLog, { foreignKey: 'userId', as: 'activityLogs' });
    db.ActivityLog.belongsTo(db.User, { foreignKey: 'userId', as: 'User' });
  }
  
  if (db.BillingRecord && typeof db.BillingRecord.belongsTo === 'function') {
    db.User.hasMany(db.BillingRecord, { foreignKey: 'userId', as: 'billingRecords' });
    db.BillingRecord.belongsTo(db.User, { foreignKey: 'userId', as: 'User' });
  }
  
  if (db.Campaign && typeof db.Campaign.belongsTo === 'function') {
    db.User.hasMany(db.Campaign, { foreignKey: 'userId', as: 'campaigns' });
    db.Campaign.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
  }
  
  if (db.Message && typeof db.Message.belongsTo === 'function') {
    db.User.hasMany(db.Message, { foreignKey: 'userId', as: 'messages' });
    db.Message.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
    if (db.Campaign && typeof db.Campaign.belongsTo === 'function') {
      db.Message.belongsTo(db.Campaign, { foreignKey: 'campaignId', as: 'campaign' });
    }
  }
  
  if (db.OTPRequest && typeof db.OTPRequest.belongsTo === 'function') {
    db.User.hasMany(db.OTPRequest, { foreignKey: 'userId', as: 'otpRequests' });
    db.OTPRequest.belongsTo(db.User, { foreignKey: 'userId', as: 'User' });
  }
  
  if (db.Payment && typeof db.Payment.belongsTo === 'function') {
    db.User.hasMany(db.Payment, { foreignKey: 'userId', as: 'payments' });
    db.Payment.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
  }
} else {
  console.error('User model is not a valid Sequelize model. Check User.js for errors.');
  console.log('db.User type:', typeof db.User);
  if (db.User) console.log('db.User prototype:', Object.getPrototypeOf(db.User));
}

db.sequelize = sequelize;
db.Sequelize = require('sequelize');

module.exports = db;