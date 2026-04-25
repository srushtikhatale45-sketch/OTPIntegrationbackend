const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const crypto = require('crypto');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  phone: { type: DataTypes.STRING(20) },
  name: { type: DataTypes.STRING, allowNull: false },
  company: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  apiKey: { type: DataTypes.STRING, unique: true, field: 'api_key' },
  apiSecret: { type: DataTypes.STRING, field: 'api_secret' },
  balance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  services: { type: DataTypes.JSONB, defaultValue: { sms: true, whatsapp: false, email: true } },
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
});

User.associate = (models) => {
  User.hasMany(models.Campaign, { foreignKey: 'userId', as: 'campaigns' });
  User.hasMany(models.Message, { foreignKey: 'userId', as: 'messages' });
  User.hasMany(models.Payment, { foreignKey: 'userId', as: 'payments' });
  User.hasMany(models.OTPRequest, { foreignKey: 'userId', as: 'otpRequests' });
};

module.exports = User;