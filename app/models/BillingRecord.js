const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BillingRecord = sequelize.define('BillingRecord', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  type: { type: DataTypes.ENUM('debit', 'credit'), allowNull: false },
  amount: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
  description: { type: DataTypes.STRING },
  otpRequestId: { type: DataTypes.UUID, field: 'otp_request_id' },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' }
}, { 
  tableName: 'billing_records', 
  timestamps: false, 
  underscored: true 
});

// Association method
BillingRecord.associate = (models) => {
  BillingRecord.belongsTo(models.User, { foreignKey: 'userId', as: 'User' });
  BillingRecord.belongsTo(models.OTPRequest, { foreignKey: 'otpRequestId', as: 'OTPRequest' });
};

module.exports = BillingRecord;