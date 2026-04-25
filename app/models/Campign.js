const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Campaign = sequelize.define('Campaign', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  name: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  channel: { type: DataTypes.ENUM('sms', 'whatsapp', 'email'), allowNull: false },
  recipients: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  status: { type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'), defaultValue: 'pending' },
  successCount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'success_count' },
  failedCount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'failed_count' },
  totalCost: { type: DataTypes.DECIMAL(10, 4), defaultValue: 0, field: 'total_cost' },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' }
}, { 
  tableName: 'campaigns', 
  timestamps: false, 
  underscored: true 
});

Campaign.associate = (models) => {
  Campaign.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  Campaign.hasMany(models.Message, { foreignKey: 'campaignId', as: 'messages' });
};

module.exports = Campaign;