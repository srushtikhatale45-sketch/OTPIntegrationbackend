const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VisitorOTP = sequelize.define('VisitorOTP', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  visitorId: { type: DataTypes.UUID, allowNull: false },
  identifier: { type: DataTypes.STRING, allowNull: false },
  channel: { type: DataTypes.ENUM('sms', 'whatsapp', 'email'), allowNull: false },
  otpCode: { type: DataTypes.STRING(6) },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: { type: DataTypes.ENUM('pending', 'sent', 'verified', 'failed'), defaultValue: 'pending' },
  attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { timestamps: false });

module.exports = VisitorOTP;