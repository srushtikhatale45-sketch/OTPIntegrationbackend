const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

let dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  dbUrl = dbUrl.replace(/&channel_binding=[^&]*/g, '');
  dbUrl = dbUrl.replace(/\?channel_binding=[^&]*&?/g, '?');
}

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected');

    // Import all models and sync
    const db = require('../models');
    await sequelize.sync({ alter: true });
    console.log('✅ Database synced');

    // Create default admin if not exists
    const Admin = require('../models/Admin');
    const bcrypt = require('bcryptjs');
    const adminExists = await Admin.findOne({ where: { email: process.env.ADMIN_EMAIL || 'admin@otpplatform.com' } });
    if (!adminExists) {
      await Admin.create({
        email: process.env.ADMIN_EMAIL || 'admin@otpplatform.com',
        password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123456', 10),
        name: 'Super Admin',
        role: 'super_admin'
      });
      console.log(`✅ Default admin created`);
    }

    return true;
  } catch (error) {
    console.error('Database error:', error.message);
    return false;
  }
};

module.exports = { sequelize, connectDB };