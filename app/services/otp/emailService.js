const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Send OTP via Email using richsol.com API with template
 * @param {string} email - Recipient email address
 * @param {string} otpCode - 6-digit OTP code
 * @returns {Promise<object>} - Result object
 */
const sendOTPviaEmail = async (email, otpCode) => {
  try {
    const username = process.env.EMAIL_USERNAME;
    const password = process.env.EMAIL_PASSWORD;
    const bearerToken = process.env.EMAIL_BEARER_TOKEN;
    const templateId = parseInt(process.env.EMAIL_TEMPLATE_ID) || 817;
    const fromEmail = process.env.EMAIL_FROM;
    const fromName = process.env.EMAIL_FROM_NAME;
    const apiUrl = process.env.EMAIL_API_URL;
    
    console.log('\n📧 Email Service Debug:');
    console.log(`   Recipient: ${email}`);
    console.log(`   OTP: ${otpCode}`);
    console.log(`   Bearer Token: ${bearerToken ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Username: ${username ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Template ID: ${templateId}`);
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Use Bearer token if available, otherwise use Basic Auth
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
      console.log('   Auth Method: Bearer Token');
    } else if (username && password) {
      headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
      console.log('   Auth Method: Basic Auth');
    } else {
      console.log('⚠️ No authentication credentials found, using simulated mode');
      return sendSimulatedEmail(email, otpCode);
    }

    // Get name from email (before @)
    const userName = email.split('@')[0];

    // Prepare request body matching your curl exactly
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

    console.log(`\n📤 Sending Email via richsol.com API`);
    console.log(`   API URL: ${apiUrl}`);
    console.log(`   Template ID: ${templateId}`);
    console.log(`   To: ${email}`);

    const response = await axios.post(apiUrl, requestBody, {
      headers: headers,
      timeout: 30000
    });
    
    console.log('✅ Email API Response:', JSON.stringify(response.data, null, 2));
    console.log('✅ Email sent successfully!');
    
    return { 
      success: true, 
      message: 'Email sent successfully', 
      response: response.data 
    };
    
  } catch (error) {
    console.error('❌ Email API Error:', error.message);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.error('⚠️ Authentication failed. Check EMAIL_BEARER_TOKEN in .env');
      } else if (error.response.status === 404) {
        console.error('⚠️ API endpoint not found. Check EMAIL_API_URL');
      } else if (error.response.status === 400) {
        console.error('⚠️ Bad request. Check template_id and request format');
      }
    }
    
    console.log('⚠️ Falling back to simulated email mode...');
    return sendSimulatedEmail(email, otpCode);
  }
};

// Simulated email for development (fallback when API fails)
const sendSimulatedEmail = (email, otpCode) => {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║              📧 SIMULATED EMAIL SENT                            ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║ To:      ${email.padEnd(44)}║`);
  console.log(`║ OTP:     ${otpCode.padEnd(44)}║`);
  console.log(`║ Template ID: 817${' '.padEnd(36)}║`);
  console.log(`║ From:    Rich System Solutions PVT LTD.${' '.padEnd(19)}║`);
  console.log(`║ Subject: Your OTP Verification Code${' '.padEnd(19)}║`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  return { success: true, simulated: true, message: 'Email simulated' };
};

/**
 * Test email configuration
 */
const testEmailConfig = async () => {
  try {
    console.log('🔍 Testing Email Configuration...\n');
    
    const bearerToken = process.env.EMAIL_BEARER_TOKEN;
    const apiUrl = process.env.EMAIL_API_URL;
    
    console.log(`📧 API URL: ${apiUrl}`);
    console.log(`🔑 Bearer Token: ${bearerToken ? '✅ Set' : '❌ Missing'}`);
    console.log(`📝 Template ID: ${process.env.EMAIL_TEMPLATE_ID}`);
    
    if (!bearerToken) {
      console.log('\n❌ Bearer token missing in .env file');
      return false;
    }
    
    // Send test email
    const testEmail = 'test@example.com';
    const testOtp = '123456';
    
    console.log('\n📤 Sending test email...');
    const result = await sendOTPviaEmail(testEmail, testOtp);
    
    if (result.success && !result.simulated) {
      console.log('\n✅ Email configuration is working!');
      return true;
    } else if (result.simulated) {
      console.log('\n⚠️ Email is in simulated mode. Check your Bearer token.');
      return false;
    } else {
      console.log('\n❌ Email configuration failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Email test error:', error.message);
    return false;
  }
};

module.exports = { 
  sendOTPviaEmail, 
  sendSimulatedEmail,
  testEmailConfig
};