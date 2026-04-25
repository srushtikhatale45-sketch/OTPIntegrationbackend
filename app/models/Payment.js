const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  type: { type: DataTypes.ENUM('credit', 'debit'), defaultValue: 'credit' },
  description: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('pending', 'completed', 'failed'), defaultValue: 'completed' },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' }
}, { 
  tableName: 'payments', 
  timestamps: false, 
  underscored: true 
});

Payment.associate = (models) => {
  Payment.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
};

module.exports = Payment;