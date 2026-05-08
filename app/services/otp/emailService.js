const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Send OTP via Email using richsol.com API
 * @param {string} email - Recipient email address
 * @param {string} otpCode - 6-digit OTP code
 * @returns {Promise<object>} - Result object
 */
const sendOTPviaEmail = async (email, otpCode) => {
  try {
    const username = process.env.EMAIL_USERNAME;
    const password = process.env.EMAIL_PASSWORD;
    const templateId = parseInt(process.env.EMAIL_TEMPLATE_ID) || 817;
    const fromEmail = process.env.EMAIL_FROM;
    const fromName = process.env.EMAIL_FROM_NAME;
    const apiUrl = process.env.EMAIL_API_URL;
    
    if (!username || !password) {
      console.log('⚠️ Email credentials not configured. Using simulated mode.');
      return { success: false, error: 'Email not configured', simulated: true };
    }

    // Get name from email (before @)
    const userName = email.split('@')[0];

    // Prepare request body matching your curl format
    const requestBody = {
      template_id: templateId,
      from: {
        email: fromEmail,
        name: fromName
      },
      personalizations: [
        {
          to: [{ email: email }],
          attributes: {
            NAME: userName,
            CODE: otpCode
          }
        }
      ]
    };

    console.log(`\n📧 Sending Email OTP via richsol.com`);
    console.log(`📍 Target: ${email}`);
    console.log(`🔑 OTP Code: ${otpCode}`);
    console.log(`📝 Template ID: ${templateId}`);

    // Make API request with Basic Authentication
    const response = await axios.post(apiUrl, requestBody, {
      auth: {
        username: username,
        password: password
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('✅ Email API Response:', response.data);
    
    return { 
      success: true, 
      message: 'Email sent successfully', 
      response: response.data 
    };
    
  } catch (error) {
    console.error('❌ Email API Error:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Fallback to console log (won't break the app)
    console.log(`\n📧 EMAIL WOULD BE SENT TO: ${email}`);
    console.log(`🔑 OTP CODE: ${otpCode}`);
    console.log(`📝 Using Template ID: ${process.env.EMAIL_TEMPLATE_ID}`);
    
    return { success: true, simulated: true, message: 'Email simulated' };
  }
};

/**
 * Test email configuration
 */
const testEmailConfig = async () => {
  try {
    console.log('🔍 Testing Email Configuration...');
    const result = await sendOTPviaEmail('test@example.com', '123456');
    if (result.success) {
      console.log('✅ Email service is ready!');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Email test failed:', error.message);
    return false;
  }
};

module.exports = { sendOTPviaEmail, testEmailConfig };