// src/services/walletService.js
const db = require('../config/db');

async function getBalance(companyId) {
  const [[row]] = await db.query(
    `SELECT wallet_balance_bdt, rate_per_minute_bdt FROM companies WHERE id=?`,
    [companyId]
  );
  return row;
}

async function credit(companyId, amount, { referenceType = null, referenceId = null, note = null } = {}) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[company]] = await conn.query(
      `SELECT wallet_balance_bdt FROM companies WHERE id=? FOR UPDATE`,
      [companyId]
    );
    const newBalance = Number(company.wallet_balance_bdt) + Number(amount);

    await conn.query(`UPDATE companies SET wallet_balance_bdt=? WHERE id=?`, [newBalance, companyId]);
    await conn.query(
      `INSERT INTO wallet_transactions (company_id, type, amount, balance_after, reference_type, reference_id, note)
       VALUES (?, 'topup', ?, ?, ?, ?, ?)`,
      [companyId, amount, newBalance, referenceType, referenceId, note]
    );

    await conn.commit();
    return newBalance;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ===== DEBIT FOR CALL (WITH BALANCE CHECK) =====
async function debitForCall(companyId, campaignNumberId, durationSeconds) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[company]] = await conn.query(
      `SELECT wallet_balance_bdt, rate_per_minute_bdt FROM companies WHERE id=? FOR UPDATE`,
      [companyId]
    );

    // Check if enough balance
    if (Number(company.wallet_balance_bdt) < Number(company.rate_per_minute_bdt)) {
      throw new Error('Insufficient balance for this call');
    }

    const billableMinutes = Math.max(1, Math.ceil((durationSeconds || 0) / 60));
    const cost = Number((billableMinutes * Number(company.rate_per_minute_bdt)).toFixed(2));
    const newBalance = Number((Number(company.wallet_balance_bdt) - cost).toFixed(2));

    await conn.query(`UPDATE companies SET wallet_balance_bdt=? WHERE id=?`, [newBalance, companyId]);
    await conn.query(
      `INSERT INTO wallet_transactions (company_id, type, amount, balance_after, reference_type, reference_id, note)
       VALUES (?, 'call_charge', ?, ?, 'campaign_number', ?, ?)`,
      [companyId, -cost, newBalance, campaignNumberId, `${billableMinutes} min @ ${company.rate_per_minute_bdt}/min`]
    );
    await conn.query(`UPDATE campaign_numbers SET cost_bdt=? WHERE id=?`, [cost, campaignNumberId]);

    await conn.commit();
    return { cost, newBalance };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function listTransactions(companyId, limit = 50) {
  const [rows] = await db.query(
    `SELECT * FROM wallet_transactions WHERE company_id=? ORDER BY id DESC LIMIT ?`,
    [companyId, limit]
  );
  return rows;
}

// ===== CHECK IF ENOUGH FOR ONE CALL =====
async function hasEnoughForOneCall(companyId) {
  const { wallet_balance_bdt, rate_per_minute_bdt } = await getBalance(companyId);
  return Number(wallet_balance_bdt) >= Number(rate_per_minute_bdt);
}

// ===== CHECK IF ENOUGH FOR MULTIPLE CALLS =====
async function hasEnoughForCalls(companyId, numberOfCalls) {
  const { wallet_balance_bdt, rate_per_minute_bdt } = await getBalance(companyId);
  const requiredBalance = Number(rate_per_minute_bdt) * numberOfCalls;
  return Number(wallet_balance_bdt) >= requiredBalance;
}

// ===== GET AVAILABLE CALL COUNT =====
async function getAvailableCallCount(companyId) {
  const { wallet_balance_bdt, rate_per_minute_bdt } = await getBalance(companyId);
  if (Number(rate_per_minute_bdt) === 0) return 0;
  return Math.floor(Number(wallet_balance_bdt) / Number(rate_per_minute_bdt));
}

// ===== ADD BALANCE =====
async function addBalance(companyId, amount, method = 'bKash', reference = null) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Check if company exists
    const [companies] = await conn.query(
      `SELECT id, wallet_balance_bdt FROM companies WHERE id=? FOR UPDATE`,
      [companyId]
    );

    if (companies.length === 0) {
      // If company doesn't exist, create one
      await conn.query(
        `INSERT INTO companies (id, name, wallet_balance_bdt, rate_per_minute_bdt) VALUES (?, ?, ?, ?)`,
        [companyId, 'Test Company', 0, 2.00]
      );
      
      const [newCompany] = await conn.query(
        `SELECT wallet_balance_bdt FROM companies WHERE id=? FOR UPDATE`,
        [companyId]
      );
      companies[0] = newCompany;
    }

    const currentBalance = Number(companies[0]?.wallet_balance_bdt || 0);
    const newBalance = currentBalance + Number(amount);

    console.log(`💰 Updating balance: ${currentBalance} + ${amount} = ${newBalance}`);

    await conn.query(
      `UPDATE companies SET wallet_balance_bdt=? WHERE id=?`,
      [newBalance, companyId]
    );
    
    await conn.query(
      `INSERT INTO wallet_transactions 
       (company_id, type, amount, balance_after, reference_type, reference_id, note)
       VALUES (?, 'topup', ?, ?, 'bkash', ?, ?)`,
      [companyId, amount, newBalance, reference, `Payment via ${method} - ${reference}`]
    );

    await conn.commit();
    console.log(`✅ Balance updated successfully: ${newBalance}`);
    return { success: true, newBalance };
  } catch (err) {
    await conn.rollback();
    console.error('❌ Add balance error:', err);
    throw err;
  } finally {
    conn.release();
  }
}

async function createPendingPayment(companyId, paymentID, amount, invoiceNumber) {
  const conn = await db.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS pending_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        payment_id VARCHAR(255) NOT NULL UNIQUE,
        amount DECIMAL(15,2) NOT NULL,
        invoice_number VARCHAR(100) NOT NULL,
        status ENUM('pending', 'completed', 'failed', 'canceled') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_company_id (company_id),
        INDEX idx_payment_id (payment_id),
        INDEX idx_status (status)
      )
    `);

    await conn.query(
      `INSERT INTO pending_payments (company_id, payment_id, amount, invoice_number, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [companyId, paymentID, amount, invoiceNumber]
    );
    
    return { success: true };
  } catch (err) {
    console.error('Create pending payment error:', err);
    throw err;
  } finally {
    conn.release();
  }
}

async function updatePaymentStatus(paymentID, status) {
  const conn = await db.getConnection();
  try {
    await conn.query(
      `UPDATE pending_payments SET status = ?, updated_at = NOW() WHERE payment_id = ?`,
      [status, paymentID]
    );
    return { success: true };
  } catch (err) {
    console.error('Update payment status error:', err);
    throw err;
  } finally {
    conn.release();
  }
}

async function getPendingPayment(paymentID) {
  const [rows] = await db.query(
    `SELECT * FROM pending_payments WHERE payment_id = ? AND status = 'pending'`,
    [paymentID]
  );
  return rows[0] || null;
}

module.exports = { 
  getBalance,
  credit, 
  debitForCall, 
  listTransactions, 
  hasEnoughForOneCall,
  hasEnoughForCalls,
  getAvailableCallCount,
  addBalance,
  createPendingPayment,
  updatePaymentStatus,
  getPendingPayment
};