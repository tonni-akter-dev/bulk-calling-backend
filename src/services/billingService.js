const db = require('../config/db');
const bkash = require('./bkashService');
const wallet = require('./walletService');

async function getBillingOverview(companyId) {
  const [[overview]] = await db.query(
    `SELECT 
      SUM(CASE WHEN status = 'Unpaid' THEN total_amount ELSE 0 END) AS invoicesDue,
      SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END) AS totalPaid
     FROM invoices 
     WHERE company_id = ?`,
    [companyId]
  );

  const [invoices] = await db.query(
    `SELECT 
      id,
      invoice_number AS invoiceNo,
      status,
      total_amount AS total,
      created_at AS invoiceDate,
      due_date AS dueDate,
      paid_at AS datePaid
     FROM invoices
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId]
  );

  return {
    invoicesDue: overview.invoicesDue || 0,
    totalPaid: overview.totalPaid || 0,
    invoices,
  };
}

async function getInvoiceDetails(companyId, invoiceId) {
  const [[invoice]] = await db.query(
    `SELECT * FROM invoices WHERE id = ? AND company_id = ?`,
    [invoiceId, companyId]
  );

  if (!invoice) throw new Error('Invoice not found');

  const [items] = await db.query(
    `SELECT description, vat, unit_cost AS unitCost, qty, price FROM invoice_items WHERE invoice_id = ?`,
    [invoice.id]
  );

  return { ...invoice, items };
}

async function payWithCredit(companyId, invoiceId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[invoice]] = await conn.query(
      `SELECT * FROM invoices WHERE id = ? AND company_id = ? FOR UPDATE`,
      [invoiceId, companyId]
    );

    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'Paid') throw new Error('Invoice is already paid');

    // Deduct total amount from wallet balance
    const currentBalance = await wallet.getBalance(companyId);
    if (Number(currentBalance.wallet_balance_bdt) < Number(invoice.total_amount)) {
      throw new Error('Insufficient credit balance to pay this invoice');
    }

    // Debit wallet
    await conn.query(
      `UPDATE companies SET wallet_balance_bdt = wallet_balance_bdt - ? WHERE id = ?`,
      [invoice.total_amount, companyId]
    );

    // Update invoice status
    await conn.query(
      `UPDATE invoices SET status = 'Paid', paid_at = NOW(), payment_method = 'Credit' WHERE id = ?`,
      [invoiceId]
    );

    // Log transaction
    await conn.query(
      `INSERT INTO wallet_transactions (company_id, type, amount, reference_type, reference_id, note)
       VALUES (?, 'invoice_payment', ?, 'invoice', ?, 'Paid Invoice via Wallet Credit')`,
      [companyId, -invoice.total_amount, invoiceId]
    );

    await conn.commit();
    return { success: true, message: 'Invoice paid successfully using account credit' };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function initiateBkashPayment(companyId, invoiceId) {
  const [[invoice]] = await db.query(
    `SELECT total_amount FROM invoices WHERE id = ? AND company_id = ? AND status = 'Unpaid'`,
    [invoiceId, companyId]
  );

  if (!invoice) throw new Error('Invoice not found or already paid');

  // Request payment URL from bKash payment gateway
  const paymentResponse = await bkash.createPayment({
    amount: invoice.total_amount,
    invoiceId: invoiceId,
    callbackUrl: `${process.env.BASE_URL}/api/billing/bkash/callback`,
  });

  return paymentResponse;
}

module.exports = { getBillingOverview, getInvoiceDetails, payWithCredit, initiateBkashPayment };