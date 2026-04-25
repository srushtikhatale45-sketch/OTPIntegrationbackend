const app = require('./app/app');
const { connectDB } = require('./app/config/database');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to database
  await connectDB();
  
  // Start the server
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`✅ Health: http://localhost:${PORT}/health`);
    console.log(`📱 OTP API: POST http://localhost:${PORT}/api/otp/send`);
    console.log(`👥 Admin API: POST http://localhost:${PORT}/api/admin/login\n`);
  });
};

startServer();