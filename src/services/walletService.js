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

async function debitForCall(companyId, campaignNumberId, durationSeconds) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[company]] = await conn.query(
      `SELECT wallet_balance_bdt, rate_per_minute_bdt FROM companies WHERE id=? FOR UPDATE`,
      [companyId]
    );

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

async function hasEnoughForOneCall(companyId) {
  const { wallet_balance_bdt, rate_per_minute_bdt } = await getBalance(companyId);
  return Number(wallet_balance_bdt) >= Number(rate_per_minute_bdt);
}

module.exports = { getBalance, credit, debitForCall, listTransactions, hasEnoughForOneCall };