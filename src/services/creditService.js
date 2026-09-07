// src/services/creditService.js
const db = require('../config/db');

async function createCreditHistory(data) {
  const { companyId, amount, type, method, reference, status, description } = data;
  
  const [result] = await db.query(
    `INSERT INTO wallet_transactions 
     (company_id, type, amount, balance_after, reference_type, reference_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      companyId,
      type === 'deposit' ? 'topup' : type,
      amount,
      0, // balance_after will be updated separately
      method?.toLowerCase() || 'system',
      reference,
      description || `Payment via ${method}`
    ]
  );
  
  return { id: result.insertId, ...data };
}

async function getCreditHistory(companyId, limit = 50) {
  const [rows] = await db.query(
    `SELECT * FROM wallet_transactions 
     WHERE company_id = ? 
     ORDER BY id DESC 
     LIMIT ?`,
    [companyId, limit]
  );
  
  return rows.map(row => ({
    id: row.id,
    amount: Math.abs(Number(row.amount)),
    type: row.type === 'topup' ? 'deposit' : row.type,
    method: row.reference_type === 'bkash' ? 'bKash' : row.reference_type || 'System',
    reference: row.reference_id,
    status: 'completed',
    description: row.note,
    created_at: row.created_at
  }));
}

module.exports = { createCreditHistory, getCreditHistory };