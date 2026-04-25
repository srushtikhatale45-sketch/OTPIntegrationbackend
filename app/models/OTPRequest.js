const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OTPRequest = sequelize.define('OTPRequest', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  identifier: { type: DataTypes.STRING, allowNull: false },
  channel: { type: DataTypes.ENUM('sms', 'whatsapp', 'email'), allowNull: false },
  otpCode: { type: DataTypes.STRING(6), field: 'otp_code' },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_verified' },
  status: { type: DataTypes.ENUM('pending', 'sent', 'verified', 'failed'), defaultValue: 'pending' },
  cost: { type: DataTypes.DECIMAL(10, 4), defaultValue: 0 },
  attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  ipAddress: { type: DataTypes.STRING(45), field: 'ip_address' },
  userAgent: { type: DataTypes.TEXT, field: 'user_agent' },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' }
}, { 
  tableName: 'otp_requests', 
  timestamps: false, 
  underscored: true 
});

// Association method
OTPRequest.associate = (models) => {
  OTPRequest.belongsTo(models.User, { foreignKey: 'userId', as: 'User' });
};

module.exports = OTPRequest;