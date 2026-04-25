const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ActivityLog = sequelize.define('ActivityLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, field: 'user_id' },
  action: { type: DataTypes.STRING, allowNull: false },
  details: { type: DataTypes.JSONB },
  ipAddress: { type: DataTypes.STRING(45), field: 'ip_address' },
  userAgent: { type: DataTypes.TEXT, field: 'user_agent' },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' }
}, { 
  tableName: 'activity_logs', 
  timestamps: false, 
  underscored: true 
});

// Association method
ActivityLog.associate = (models) => {
  ActivityLog.belongsTo(models.User, { foreignKey: 'userId', as: 'User' });
};

module.exports = ActivityLog;