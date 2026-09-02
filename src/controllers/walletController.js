const db = require('../config/db');
const bkash = require('../services/bkashService');
const wallet = require('../services/walletService');

async function getBalance(req, res) {
  const balance = await wallet.getBalance(req.user.companyId);
  res.json(balance);
}

async function getTransactions(req, res) {
  const rows = await wallet.listTransactions(req.user.companyId, Number(req.query.limit) || 50);
  res.json(rows);
}

// Step 1: create a bKash payment to add funds to the wallet
async function initiateTopup(req, res) {
  const { amount } = req.body;
  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount < 10) {
    return res.status(400).json({ error: 'Minimum top-up amount is 10 BDT' });
  }

  const invoiceNumber = `TOPUP-${req.user.companyId}-${Date.now()}`;
  const bkashPayment = await bkash.createPayment({
    amount: numericAmount,
    invoiceNumber,
    callbackURL: `${process.env.BASE_URL}/api/wallet/bkash/callback`
  });

  await db.query(
    `INSERT INTO wallet_topups (company_id, bkash_payment_id, amount, status, raw_response)
     VALUES (?, ?, ?, 'initiated', ?)`,
    [req.user.companyId, bkashPayment.paymentID, numericAmount, JSON.stringify(bkashPayment)]
  );

  res.json({ bkashURL: bkashPayment.bkashURL, paymentID: bkashPayment.paymentID });
}

// Step 2: bKash redirects the browser back here after checkout
async function bkashCallback(req, res) {
  const { paymentID, status } = req.query;

  const [[topup]] = await db.query('SELECT * FROM wallet_topups WHERE bkash_payment_id=?', [paymentID]);
  if (!topup) return res.status(404).send('Top-up record not found');

  if (status !== 'success') {
    await db.query('UPDATE wallet_topups SET status="cancelled" WHERE id=?', [topup.id]);
    return res.redirect(`${process.env.BASE_URL}/wallet?status=cancelled`);
  }

  const result = await bkash.executePayment(paymentID);

  if (result.transactionStatus === 'Completed') {
    await db.query(
      'UPDATE wallet_topups SET status="completed", bkash_trx_id=?, raw_response=? WHERE id=?',
      [result.trxID, JSON.stringify(result), topup.id]
    );

    await wallet.credit(topup.company_id, topup.amount, {
      referenceType: 'wallet_topup',
      referenceId: topup.id,
      note: `bKash top-up, trxID ${result.trxID}`
    });

    return res.redirect(`${process.env.BASE_URL}/wallet?status=success`);
  } else {
    await db.query('UPDATE wallet_topups SET status="failed", raw_response=? WHERE id=?', [JSON.stringify(result), topup.id]);
    return res.redirect(`${process.env.BASE_URL}/wallet?status=failed`);
  }
}

module.exports = { getBalance, getTransactions, initiateTopup, bkashCallback };
