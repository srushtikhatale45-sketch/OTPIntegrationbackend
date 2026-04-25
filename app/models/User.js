const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  phone: { type: DataTypes.STRING(20) },
  name: { type: DataTypes.STRING, allowNull: false },
  company: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  apiKey: { type: DataTypes.STRING, unique: true, field: 'api_key' },
  balance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'updated_at' }
}, { 
  tableName: 'users', 
  timestamps: true, 
  underscored: true 
});

// Association method
User.associate = (models) => {
  User.hasMany(models.OTPRequest, { foreignKey: 'userId', as: 'OTPRequests' });
  User.hasMany(models.ActivityLog, { foreignKey: 'userId', as: 'ActivityLogs' });
  User.hasMany(models.BillingRecord, { foreignKey: 'userId', as: 'BillingRecords' });
};

module.exports = User;