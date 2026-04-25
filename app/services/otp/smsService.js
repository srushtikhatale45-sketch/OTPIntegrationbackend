const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const sendSMSOTP = async (phoneNumber, otpCode) => {
  try {
    const username = process.env.SMS_USERNAME;
    const password = process.env.SMS_PASSWORD;
    const senderId = process.env.SMS_SENDER;
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const message = `Dear ${username} Your OTP is : ${otpCode}. Rich Solutions.`;

    const url = `https://www.smsjust.com/sms/user/urlsms.php?username=${username}&pass=${password}&senderid=${senderId}&dest_mobileno=${cleanNumber}&msgtype=TXT&message=${encodeURIComponent(message)}&response=Y`;

    const response = await axios.get(url, { timeout: 15000 });
    
    if (response.data && (response.data.includes('Success') || response.status === 200)) {
      return { success: true, messageId: response.data };
    }
    return { success: false, error: 'SMS delivery failed' };
  } catch (error) {
    console.error('SMS error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendSMSOTP };