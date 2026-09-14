// utils/sms.js
/**
 * Plug in your provider (Twilio, MSG91, Vonage, AWS SNS...).
 * In dev, set SMS_DISABLED=true and the code is logged to the console.
 */
async function sendSms({ to, message }) {
  if (process.env.SMS_DISABLED === 'true' || !process.env.SMS_PROVIDER) {
    console.log(`\n[sms:disabled] to=${to}\n${message}\n`);
    return;
  }

  if (process.env.SMS_PROVIDER === 'twilio') {
    // npm i twilio
    const twilio = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    await twilio.messages.create({
      from: process.env.TWILIO_FROM,
      to,
      body: message
    });
    return;
  }

  throw new Error(`Unsupported SMS_PROVIDER: ${process.env.SMS_PROVIDER}`);
}

module.exports = { sendSms };