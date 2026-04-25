const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const sendWhatsAppOTP = async (phoneNumber, otpCode) => {
  try {
    const apiKey = process.env.PINBOT_API_KEY;
    const phoneNumberId = process.env.PHONE_NUMBER_ID;
    
    if (!apiKey || !phoneNumberId) {
      console.error('WhatsApp credentials missing');
      return { success: false, error: 'WhatsApp service not configured' };
    }
    
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const formattedNumber = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;
    const toNumber = parseInt(formattedNumber);
    const apiUrl = `https://partnersv1.pinbot.ai/v3/${phoneNumberId}/messages`;

    // Using TEMPLATE format (as shown in your curl)
    const requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toNumber,
      type: "template",
      template: {
        name: "auth_template_001",
        language: {
          code: "en"
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: otpCode  // This replaces the placeholder in template
              }
            ]
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [
              {
                type: "payload",
                payload: ""
              }
            ]
          }
        ]
      }
    };

    console.log(`📤 Sending WhatsApp OTP via template to ${toNumber}: ${otpCode}`);
    console.log(`📡 API URL: ${apiUrl}`);
    console.log(`📦 Template: auth_template_001`);

    const response = await axios.post(apiUrl, requestBody, {
      headers: { 
        'Content-Type': 'application/json', 
        'apikey': apiKey 
      },
      timeout: 30000
    });

    if (response.data && response.data.messages) {
      console.log(`✅ WhatsApp OTP sent successfully. Message ID: ${response.data.messages[0].id}`);
      return { success: true, messageId: response.data.messages[0].id };
    }
    
    return { success: false, error: 'WhatsApp delivery failed' };
    
  } catch (error) {
    console.error('WhatsApp error:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      
      // Check for template errors
      if (error.response.status === 400 && error.response.data?.error?.message) {
        const errorMsg = error.response.data.error.message;
        if (errorMsg.includes('template')) {
          console.error('⚠️ Template error: Make sure "auth_template_001" is approved in your PinBot dashboard');
        }
      }
    }
    
    return { success: false, error: error.message };
  }
};

// Fallback to text message if template fails
const sendWhatsAppOTPAsText = async (phoneNumber, otpCode) => {
  try {
    const apiKey = process.env.PINBOT_API_KEY;
    const phoneNumberId = process.env.PHONE_NUMBER_ID;
    
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const formattedNumber = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;
    const toNumber = parseInt(formattedNumber);
    const apiUrl = `https://partnersv1.pinbot.ai/v3/${phoneNumberId}/messages`;

    const requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toNumber,
      type: "text",
      text: { 
        body: `Your OTP verification code is: ${otpCode}. Valid for 5 minutes.\n\nDo not share this code with anyone.` 
      }
    };

    const response = await axios.post(apiUrl, requestBody, {
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      timeout: 30000
    });

    if (response.data && response.data.messages) {
      return { success: true, messageId: response.data.messages[0].id };
    }
    return { success: false, error: 'WhatsApp delivery failed' };
    
  } catch (error) {
    console.error('WhatsApp text fallback error:', error.message);
    return { success: false, error: error.message };
  }
};

// Combined function that tries template first, then falls back to text
const sendWhatsAppOTPWithFallback = async (phoneNumber, otpCode) => {
  // First try with template
  const templateResult = await sendWhatsAppOTP(phoneNumber, otpCode);
  
  if (templateResult.success) {
    return templateResult;
  }
  
  // If template fails, try with text message
  console.log('Template failed, trying text message fallback...');
  const textResult = await sendWhatsAppOTPAsText(phoneNumber, otpCode);
  
  return textResult;
};

module.exports = { 
  sendWhatsAppOTP, 
  sendWhatsAppOTPAsText, 
  sendWhatsAppOTPWithFallback 
};