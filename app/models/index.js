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

db.sequelize = sequelize;
db.Sequelize = require('sequelize');

module.exports = db;