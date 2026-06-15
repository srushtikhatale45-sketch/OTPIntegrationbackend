// backend/app/models/Customer.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Customer = sequelize.define('Customer', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' }, // client admin ID
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING(20) },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'updated_at' }
}, { tableName: 'customers', timestamps: true, underscored: true });

Customer.associate = (models) => {
  Customer.belongsTo(models.User, { foreignKey: 'userId', as: 'clientAdmin' });
  Customer.hasMany(models.OTPRequest, { foreignKey: 'customerId', as: 'otpRequests' });
  Customer.hasMany(models.Message, { foreignKey: 'customerId', as: 'messages' });
};

module.exports = Customer;