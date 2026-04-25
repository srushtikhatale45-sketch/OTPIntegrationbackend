const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

const sendEmailOTP = async (email, otpCode) => {
  try {
    if (!transporter) {
      return { success: false, error: 'Email service not configured' };
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">OTP Verification</h2>
        <p>Your OTP verification code is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background: #f0f0f0; padding: 10px 20px; border-radius: 5px;">${otpCode}</span>
        </div>
        <p>This code is valid for 5 minutes.</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP Verification Code',
      html
    });

    return { success: true, messageId: 'email_sent' };
  } catch (error) {
    console.error('Email error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmailOTP };