const db = require('../config/db');
const { parseNumbersFromCsv } = require('../utils/numberParser');

async function listContacts(companyId, { search, group }) {
  let query = `
    SELECT id, name, phone_number AS phone, email, group_name AS \`group\`, status, created_at AS dateAdded
    FROM contacts
    WHERE company_id = ?
  `;
  const params = [companyId];

  if (search) {
    query += ` AND (name LIKE ? OR phone_number LIKE ? OR email LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (group && group !== 'All') {
    query += ` AND group_name = ?`;
    params.push(group);
  }

  query += ` ORDER BY id DESC`;

  const [contacts] = await db.query(query, params);

  // Top summary card metrics matching your screenshot
  const [[metrics]] = await db.query(
    `SELECT 
      COUNT(*) AS totalContacts,
      SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS activeReachable,
      SUM(CASE WHEN status = 'Unsubscribed' THEN 1 ELSE 0 END) AS unsubscribed,
      SUM(CASE WHEN status = 'Bounced' THEN 1 ELSE 0 END) AS bounced
     FROM contacts WHERE company_id = ?`,
    [companyId]
  );

  return {
    contacts,
    metrics: {
      totalContacts: metrics.totalContacts || 0,
      activeReachable: metrics.activeReachable || 0,
      unsubscribed: metrics.unsubscribed || 0,
      bounced: metrics.bounced || 0,
    },
  };
}

async function createContact(companyId, { name, phone, email, group }) {
  if (!name || !phone) throw new Error('Name and phone number are required');

  const [result] = await db.query(
    `INSERT INTO contacts (company_id, name, phone_number, email, group_name, status)
     VALUES (?, ?, ?, ?, ?, 'Active')`,
    [companyId, name, phone, email || null, group || 'VIP Customers']
  );

  return { id: result.insertId, name, phone, email, group: group || 'VIP Customers', status: 'Active' };
}

async function importCsv(companyId, fileBuffer, groupName = 'CSV Import') {
  if (!fileBuffer) throw new Error('No CSV file provided');

  const parsedNumbers = parseNumbersFromCsv(fileBuffer);
  if (!parsedNumbers.length) throw new Error('No valid numbers found in CSV');

  const values = parsedNumbers.map((num) => [companyId, num, groupName, 'Active']);
  await db.query(
    `INSERT INTO contacts (company_id, phone_number, group_name, status) VALUES ? 
     ON DUPLICATE KEY UPDATE updated_at = NOW()`,
    [values]
  );

  return { importedCount: parsedNumbers.length };
}

async function updateContact(companyId, contactId, { name, phone, email, group, status }) {
  const [result] = await db.query(
    `UPDATE contacts 
     SET name = COALESCE(?, name), 
         phone_number = COALESCE(?, phone_number), 
         email = COALESCE(?, email), 
         group_name = COALESCE(?, group_name),
         status = COALESCE(?, status)
     WHERE id = ? AND company_id = ?`,
    [name, phone, email, group, status, contactId, companyId]
  );

  if (result.affectedRows === 0) throw new Error('Contact not found or no changes made');
  return true;
}

async function deleteContact(companyId, contactId) {
  const [result] = await db.query(`DELETE FROM contacts WHERE id = ? AND company_id = ?`, [contactId, companyId]);
  if (result.affectedRows === 0) throw new Error('Contact not found');
  return true;
}

module.exports = { listContacts, createContact, importCsv, updateContact, deleteContact };