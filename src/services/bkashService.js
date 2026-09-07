// src/services/bkashService.js
const axios = require('axios');
require('dotenv').config();

let cachedToken = null;
let cachedTokenExpiry = 0;

function client() {
  return axios.create({
    baseURL: process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta',
    headers: { 
      'Content-Type': 'application/json', 
      'Accept': 'application/json'
    },
    timeout: 30000
  });
}

async function getToken() {
  try {
    if (cachedToken && Date.now() < cachedTokenExpiry) {
      return cachedToken;
    }

    console.log('🔑 Getting bKash token...');

    const response = await client().post(
      '/tokenized/checkout/token/grant',
      {
        app_key: process.env.BKASH_APP_KEY,
        app_secret: process.env.BKASH_APP_SECRET
      },
      {
        headers: {
          'username': process.env.BKASH_USERNAME,
          'password': process.env.BKASH_PASSWORD
        }
      }
    );

    if (response.data.statusCode === '0000' && response.data.id_token) {
      cachedToken = response.data.id_token;
      cachedTokenExpiry = Date.now() + 55 * 60 * 1000;
      console.log('✅ Token obtained successfully');
      return cachedToken;
    } else {
      throw new Error(response.data.statusMessage || 'Failed to get token');
    }
  } catch (error) {
    console.error('❌ bKash token error:', error.response?.data || error.message);
    throw error;
  }
}

async function createPayment({ amount, invoiceNumber, callbackURL }) {
  try {
    const idToken = await getToken();
    
    console.log('💰 Creating bKash payment...', { amount, invoiceNumber });

    const response = await client().post(
      '/tokenized/checkout/create',
      {
        mode: '0011',
        payerReference: invoiceNumber,
        callbackURL: callbackURL || process.env.BKASH_CALLBACK_URL,
        amount: String(amount),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: invoiceNumber
      },
      {
        headers: {
          'Authorization': idToken,
          'X-APP-Key': process.env.BKASH_APP_KEY
        }
      }
    );

    if (response.data.statusCode === '0000') {
      return response.data;
    } else {
      throw new Error(response.data.statusMessage || 'Failed to create payment');
    }
  } catch (error) {
    console.error('❌ bKash create payment error:', error.response?.data || error.message);
    throw error;
  }
}

async function executePayment(paymentID) {
  try {
    const idToken = await getToken();
    
    console.log('✅ Executing bKash payment:', paymentID);

    const response = await client().post(
      '/tokenized/checkout/execute',
      { paymentID },
      {
        headers: {
          'Authorization': idToken,
          'X-APP-Key': process.env.BKASH_APP_KEY
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('❌ bKash execute payment error:', error.response?.data || error.message);
    throw error;
  }
}

async function queryPayment(paymentID) {
  try {
    const idToken = await getToken();
    
    console.log('🔍 Querying bKash payment:', paymentID);

    const response = await client().post(
      '/tokenized/checkout/payment/status',
      { paymentID },
      {
        headers: {
          'Authorization': idToken,
          'X-APP-Key': process.env.BKASH_APP_KEY
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('❌ bKash query payment error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { createPayment, executePayment, queryPayment };