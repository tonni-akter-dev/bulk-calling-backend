const db = require('../config/db');

async function getCallLogs(companyId, { page = 1, limit = 10, mobile = '', status = '', agent = '', startDate = '', endDate = '' }) {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const offset = (pageNum - 1) * limitNum;

  let whereConditions = [`cl.company_id = ?`];
  let params = [companyId];

  // Mobile / Phone filter
  if (mobile) {
    whereConditions.push(`cl.phone_number LIKE ?`);
    params.push(`%${mobile}%`);
  }

  // Status filter (Completed, Failed, No Answer, etc.)
  if (status && status.toLowerCase() !== 'all') {
    whereConditions.push(`cl.status = ?`);
    params.push(status);
  }

  // Agent search filter
  if (agent) {
    whereConditions.push(`a.name LIKE ?`);
    params.push(`%${agent}%`);
  }

  // Date range filter
  if (startDate && endDate) {
    whereConditions.push(`cl.created_at BETWEEN ? AND ?`);
    params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
  }

  const whereClause = whereConditions.join(' AND ');

  // Query records
  const [rows] = await db.query(
    `SELECT 
      cl.id AS sn,
      cl.call_type AS callType,
      cl.phone_number AS fromTo,
      cl.ip_number AS ipNumber,
      COALESCE(a.name, 'Unassigned') AS agent,
      cl.duration_formatted AS duration,
      cl.created_at AS startedAt,
      cl.status
     FROM call_logs cl
     LEFT JOIN agents a ON cl.agent_id = a.id
     WHERE ${whereClause}
     ORDER BY cl.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  // Total count query
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM call_logs cl
     LEFT JOIN agents a ON cl.agent_id = a.id
     WHERE ${whereClause}`,
    params
  );

  return {
    data: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

async function exportCallLogs(companyId, filters) {
  // Logic to generate CSV / Excel file stream based on applied filters
  const logs = await getCallLogs(companyId, { ...filters, limit: 10000, page: 1 });
  return logs.data;
}

module.exports = { getCallLogs, exportCallLogs };