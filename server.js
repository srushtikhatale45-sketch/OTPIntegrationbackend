// backend/server.js
const app = require('./app/app');
const { connectDB } = require('./app/config/database');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`✅ Health: http://localhost:${PORT}/health`);
      console.log(`📱 POST /api/auth/user/login`);
      console.log(`🔐 POST /api/auth/admin/login\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();