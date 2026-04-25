const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuthSession = sequelize.define('AuthSession', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  token: { type: DataTypes.STRING, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  ipAddress: { type: DataTypes.STRING(45), field: 'ip_address' },
  userAgent: { type: DataTypes.TEXT, field: 'user_agent' },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' }
}, { tableName: 'auth_sessions', timestamps: false, underscored: true });

module.exports = AuthSession;