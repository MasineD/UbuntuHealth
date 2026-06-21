import dotenv from 'dotenv';
import twilio from 'twilio';
import pool from '../config/database.js';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER || '+19452708203';

let client;
if (accountSid && authToken) {
  try {
    client = twilio(accountSid, authToken);
  } catch (error) {
    console.error('Error initializing Twilio client:', error.message);
  }
}

// Format number to E.164 (South Africa focus)
function formatPhoneNumber(phone) {
  if (!phone) return null;
  let cleaned = phone.toString().replace(/\s+/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '+27' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

export async function sendSMS(to, body) {
  const formattedTo = formatPhoneNumber(to);
  if (!formattedTo) {
    console.error('Error sending SMS: Invalid phone number.');
    return;
  }

  if (!client) {
    console.warn(`[Mock SMS] To: ${formattedTo}, Message: "${body}" (Twilio not initialized)`);
    return;
  }

  const msgOptions = {
    from: twilioNumber,
    to: formattedTo,
    body: body
  };

  try {
    const message = await client.messages.create(msgOptions);
    console.log(`Message sent to ${formattedTo}: ${message.sid}`);
    return message;
  } catch (error) {
    console.error(`Error sending SMS to ${formattedTo}:`, error.message);
  }
}

export async function sendSMSNotification(targetType, targetIdOrOrgName, body) {
  try {
    let phoneNumbers = [];

    if (targetType === 'patient') {
      const res = await pool.query('SELECT phone_number FROM users.patients WHERE id::text = $1', [targetIdOrOrgName.toString()]);
      if (res.rows.length > 0 && res.rows[0].phone_number) {
        phoneNumbers.push(res.rows[0].phone_number);
      }
    } else if (targetType === 'staff') {
      const res = await pool.query('SELECT phone_number FROM users.clinical_staff WHERE id::text = $1', [targetIdOrOrgName.toString()]);
      if (res.rows.length > 0 && res.rows[0].phone_number) {
        phoneNumbers.push(res.rows[0].phone_number);
      }
    } else if (targetType === 'chw') {
      const res = await pool.query('SELECT phone_number FROM users.comm_health_workers WHERE id::text = $1', [targetIdOrOrgName.toString()]);
      if (res.rows.length > 0 && res.rows[0].phone_number) {
        phoneNumbers.push(res.rows[0].phone_number);
      }
    } else if (targetType === 'admin') {
      const res = await pool.query('SELECT phone_number FROM users.admins WHERE organization = $1', [targetIdOrOrgName]);
      phoneNumbers = res.rows.map(r => r.phone_number).filter(Boolean);
    }

    if (phoneNumbers.length === 0) {
      console.log(`No phone numbers found to send SMS for ${targetType}: ${targetIdOrOrgName}`);
      return;
    }

    for (const phone of phoneNumbers) {
      await sendSMS(phone, body);
    }
  } catch (error) {
    console.error('Error dispatching SMS notifications:', error.message);
  }
}
