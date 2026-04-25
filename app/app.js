const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const otpRoutes = require('./routes/otp');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');  // Add this

const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Initialize models
require('./models');

app.use('/api/otp', otpRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);  // Add this

app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

module.exports = app;