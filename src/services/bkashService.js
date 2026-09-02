const axios = require('axios');

let cachedToken = null;
let cachedTokenExpiry = 0;

function client() {
  return axios.create({
    baseURL: process.env.BKASH_BASE_URL,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    timeout: 30000
  });
}

async function getToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;

  const res = await client().post(
    '/tokenized/checkout/token/grant',
    {
      app_key: process.env.BKASH_APP_KEY,
      app_secret: process.env.BKASH_APP_SECRET
    },
    {
      headers: {
        username: process.env.BKASH_USERNAME,
        password: process.env.BKASH_PASSWORD
      }
    }
  );

  cachedToken = res.data.id_token;
  cachedTokenExpiry = Date.now() + 55 * 60 * 1000;
  return cachedToken;
}

async function createPayment({ amount, invoiceNumber, callbackURL }) {
  const idToken = await getToken();
  const res = await client().post(
    '/tokenized/checkout/create',
    {
      mode: '0011',
      payerReference: invoiceNumber,
      callbackURL,
      amount: String(amount),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: invoiceNumber
    },
    {
      headers: {
        authorization: idToken,
        'x-app-key': process.env.BKASH_APP_KEY
      }
    }
  );
  return res.data;
}

async function executePayment(paymentID) {
  const idToken = await getToken();
  const res = await client().post(
    '/tokenized/checkout/execute',
    { paymentID },
    {
      headers: {
        authorization: idToken,
        'x-app-key': process.env.BKASH_APP_KEY
      }
    }
  );
  return res.data;
}

async function queryPayment(paymentID) {
  const idToken = await getToken();
  const res = await client().post(
    '/tokenized/checkout/payment/status',
    { paymentID },
    {
      headers: {
        authorization: idToken,
        'x-app-key': process.env.BKASH_APP_KEY
      }
    }
  );
  return res.data;
}

module.exports = { createPayment, executePayment, queryPayment };