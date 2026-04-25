const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Message = sequelize.define('Message', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  campaignId: { type: DataTypes.UUID, field: 'campaign_id' },
  recipient: { type: DataTypes.STRING, allowNull: false },
  channel: { type: DataTypes.ENUM('sms', 'whatsapp', 'email'), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'sent', 'delivered', 'failed', 'read'), defaultValue: 'pending' },
  cost: { type: DataTypes.DECIMAL(10, 4), defaultValue: 0 },
  deliveredAt: { type: DataTypes.DATE, field: 'delivered_at' },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' }
}, { 
  tableName: 'messages', 
  timestamps: false, 
  underscored: true 
});

Message.associate = (models) => {
  Message.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  Message.belongsTo(models.Campaign, { foreignKey: 'campaignId', as: 'campaign' });
};

module.exports = Message;