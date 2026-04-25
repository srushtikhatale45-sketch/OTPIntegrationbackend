const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const Admin = sequelize.define('Admin', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('super_admin', 'admin'), defaultValue: 'admin' },
  lastLogin: { type: DataTypes.DATE, field: 'last_login' },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' }
}, { tableName: 'admins', timestamps: false, underscored: true });

Admin.prototype.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = Admin;