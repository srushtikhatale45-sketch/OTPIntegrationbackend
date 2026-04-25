const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');
const Campaign = require('./Campign');
const Message = require('./Message');
const Payment = require('./Payment');
const db = {};

// Read all model files in this directory
const files = fs.readdirSync(__dirname).filter(file => {
  return (file.indexOf('.') !== 0) && 
         (file !== 'index.js') && 
         (file.slice(-3) === '.js');
});

// Import models
files.forEach(file => {
  const model = require(path.join(__dirname, file));
  const modelName = model.name || path.basename(file, '.js');
  db[modelName] = model;
  console.log(`✅ Loaded model: ${modelName}`);
});

// Set up associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// In the associations section, add:
Campaign.associate = (models) => {
  Campaign.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  Campaign.hasMany(models.Message, { foreignKey: 'campaignId', as: 'messages' });
};

Message.associate = (models) => {
  Message.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  Message.belongsTo(models.Campaign, { foreignKey: 'campaignId', as: 'campaign' });
};

Payment.associate = (models) => {
  Payment.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
};
db.sequelize = sequelize;
db.Sequelize = require('sequelize');

module.exports = db;