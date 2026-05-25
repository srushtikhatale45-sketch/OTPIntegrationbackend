const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING, allowNull: true, unique: true },
  phone: { type: DataTypes.STRING(20) },
  name: { type: DataTypes.STRING, allowNull: false },
  company: { type: DataTypes.STRING },
  password: { type: DataTypes.STRING, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  apiKey: { type: DataTypes.STRING, unique: true, field: 'api_key' },
  apiSecret: { type: DataTypes.STRING, field: 'api_secret' },
  balance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  services: { type: DataTypes.JSONB, defaultValue: { sms: true, whatsapp: false, email: true } },
  type: { type: DataTypes.ENUM('client_admin', 'end_user'), defaultValue: 'client_admin' },  // <-- ADD THIS LINE
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'updated_at' }
}, { 
  tableName: 'users', 
  timestamps: true, 
  underscored: true 
});

User.beforeCreate(async (user) => {
  if (!user.apiKey) {
    user.apiKey = crypto.randomBytes(32).toString('hex');
    user.apiSecret = crypto.randomBytes(32).toString('hex');
  }
  if (user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

User.beforeUpdate(async (user) => {
  if (user.changed('password')) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

User.prototype.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = User;