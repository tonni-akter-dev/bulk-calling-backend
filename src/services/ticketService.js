const db = require("../config/db");

async function getTicketStats(companyId, role) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  
  let query = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS inProgress,
      SUM(CASE WHEN status = 'Waiting for Customer' THEN 1 ELSE 0 END) AS waiting,
      SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
      SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closed,
      SUM(CASE WHEN priority = 'Urgent' THEN 1 ELSE 0 END) AS urgent
    FROM support_tickets
  `;

  const params = [];

  // If not admin, filter by company
  if (!isAdmin) {
    query += ` WHERE company_id = ?`;
    params.push(companyId);
  }

  const [[stats]] = await db.query(query, params);

  // If admin, get company-wise stats too
  let companyStats = [];
  if (isAdmin) {
    const [companyData] = await db.query(`
      SELECT 
        c.name AS company_name,
        COUNT(st.id) AS total_tickets,
        SUM(CASE WHEN st.status = 'Open' THEN 1 ELSE 0 END) AS open_tickets
      FROM support_tickets st
      JOIN companies c ON c.id = st.company_id
      GROUP BY st.company_id, c.name
      ORDER BY total_tickets DESC
      LIMIT 5
    `);
    companyStats = companyData;
  }

  return {
    totalTickets: String(stats?.total || 0),
    openTickets: String(stats?.open || 0),
    inProgress: String(stats?.inProgress || 0),
    waiting: String(stats?.waiting || 0),
    resolved: String(stats?.resolved || 0),
    closed: String(stats?.closed || 0),
    urgent: String(stats?.urgent || 0),
    companyStats,
  };
}

async function getTickets(companyId, role, {
  search = "",
  category = "",
  status = "",
  priority = "",
  page = 1,
  limit = 10,
}) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const offset = (pageNum - 1) * limitNum;

  const whereConditions = [];
  const params = [];

  // If not admin, filter by company
  if (!isAdmin) {
    whereConditions.push("st.company_id = ?");
    params.push(companyId);
  }

  // Search
  if (search && search.trim()) {
    const searchPattern = `%${search.trim()}%`;
    whereConditions.push(`
      (st.ticket_code LIKE ? 
      OR st.subject LIKE ? 
      OR st.category LIKE ? 
      OR st.request_type LIKE ? 
      OR st.status LIKE ? 
      OR st.priority LIKE ? 
      OR u.name LIKE ? 
      OR u.email LIKE ? 
      OR c.name LIKE ?)
    `);
    params.push(
      searchPattern, searchPattern, searchPattern, searchPattern,
      searchPattern, searchPattern, searchPattern, searchPattern,
      searchPattern
    );
  }

  // Category filter
  if (category && category.trim() && category !== "All") {
    whereConditions.push("st.category = ?");
    params.push(category.trim());
  }

  // Status filter
  if (status && status.trim() && status !== "All") {
    whereConditions.push("st.status = ?");
    params.push(status.trim());
  }

  // Priority filter
  if (priority && priority.trim() && priority !== "All") {
    whereConditions.push("st.priority = ?");
    params.push(priority.trim());
  }

  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(" AND ")}`
    : "";

  // Get total count
  const [[countResult]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM support_tickets st
      LEFT JOIN users u ON u.id = st.user_id
      LEFT JOIN companies c ON c.id = st.company_id
      ${whereClause}
    `,
    params
  );

  // Get tickets
  const [rows] = await db.query(
    `
      SELECT
        st.id AS ticket_id,
        st.ticket_code AS id,
        st.company_id,
        st.user_id,
        st.category,
        st.request_type AS type,
        st.subject,
        st.priority,
        st.status,
        st.description,
        st.attachment,
        st.resolution_note,
        DATE_FORMAT(st.created_at, '%d %b %Y • %h:%i %p') AS created_at,
        DATE_FORMAT(st.updated_at, '%d %b %Y • %h:%i %p') AS updated_at,
        u.id AS user_id,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role,
        c.name AS company_name,
        c.email AS company_email,
        (SELECT COUNT(*) FROM ticket_replies WHERE ticket_id = st.id) AS messages
      FROM support_tickets st
      LEFT JOIN users u ON u.id = st.user_id
      LEFT JOIN companies c ON c.id = st.company_id
      ${whereClause}
      ORDER BY st.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limitNum, offset]
  );

  const tickets = rows.map((ticket) => ({
    id: ticket.id,
    ticketId: ticket.ticket_id,
    companyId: ticket.company_id,
    companyName: ticket.company_name,
    companyEmail: ticket.company_email,
    user: {
      id: ticket.user_id,
      name: ticket.user_name,
      email: ticket.user_email,
      role: ticket.user_role,
    },
    category: ticket.category,
    type: ticket.type,
    subject: ticket.subject,
    priority: ticket.priority,
    status: ticket.status,
    description: ticket.description,
    attachment: ticket.attachment,
    resolutionNote: ticket.resolution_note,
    messages: ticket.messages || 0,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
  }));

  const total = Number(countResult?.total || 0);
  const totalPages = Math.ceil(total / limitNum);

  return {
    tickets,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPreviousPage: pageNum > 1,
    },
  };
}

async function getTicketById(companyId, role, userId, ticketId) {
  const isAdmin = role === 'admin' || role === 'super_admin';

  let query = `
    SELECT
      st.id,
      st.ticket_code AS id,
      st.company_id,
      st.user_id,
      st.category,
      st.request_type AS type,
      st.subject,
      st.priority,
      st.status,
      st.description,
      st.attachment,
      st.resolution_note,
      DATE_FORMAT(st.created_at, '%d %b %Y • %h:%i %p') AS created_at,
      DATE_FORMAT(st.updated_at, '%d %b %Y • %h:%i %p') AS updated_at,
      u.id AS user_id,
      u.name AS user_name,
      u.email AS user_email,
      u.role AS user_role,
      c.name AS company_name,
      c.email AS company_email
    FROM support_tickets st
    LEFT JOIN users u ON u.id = st.user_id
    LEFT JOIN companies c ON c.id = st.company_id
    WHERE st.id = ?
  `;

  const params = [ticketId];

  // If not admin, check company ownership
  if (!isAdmin) {
    query += ` AND st.company_id = ?`;
    params.push(companyId);
  }

  const [rows] = await db.query(query, params);

  if (rows.length === 0) {
    const error = new Error("Ticket not found or access denied");
    error.statusCode = 404;
    throw error;
  }

  const ticket = rows[0];

  // Get replies
  const [replies] = await db.query(
    `
      SELECT
        tr.id,
        tr.message,
        tr.attachment,
        tr.is_admin,
        u.name AS user_name,
        u.email AS user_email,
        DATE_FORMAT(tr.created_at, '%d %b %Y • %h:%i %p') AS created_at
      FROM ticket_replies tr
      LEFT JOIN users u ON u.id = tr.user_id
      WHERE tr.ticket_id = ?
      ORDER BY tr.created_at ASC
    `,
    [ticket.id]
  );

  return {
    ...ticket,
    replies: replies || [],
  };
}

async function createTicket(companyId, userId, role, data, file) {
  const { category, requestType, subject, priority, description } = data;

  if (!category) {
    const error = new Error("Please select a category.");
    error.statusCode = 400;
    throw error;
  }

  if (!requestType) {
    const error = new Error("Please select a type of request.");
    error.statusCode = 400;
    throw error;
  }

  if (!subject || !subject.trim()) {
    const error = new Error("Subject is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!description || !description.trim()) {
    const error = new Error("Please describe your issue.");
    error.statusCode = 400;
    throw error;
  }

  // Validate categories
  const allowedCategories = ["Complaint", "Request", "Billing"];
  if (!allowedCategories.includes(category)) {
    const error = new Error("Invalid ticket category.");
    error.statusCode = 400;
    throw error;
  }

  // Validate request types
  const requestTypes = {
    Complaint: ["Extension Disconnect", "Call Drop", "Billing", "Bulk Voice Call", "Voice Quality Issue"],
    Request: ["Extension Remove Request", "Call Channel", "Call Logs Report", "Telephone Configuration", "Mobile/PC Configuration", "API Integration"],
    Billing: ["Add Credit", "Payment Issue", "Invoice Request", "Balance Issue"],
  };

  if (!requestTypes[category] || !requestTypes[category].includes(requestType)) {
    const error = new Error("Invalid request type for selected category.");
    error.statusCode = 400;
    throw error;
  }

  const allowedPriorities = ["Low", "Medium", "High", "Urgent"];
  const ticketPriority = priority || "Low";
  if (!allowedPriorities.includes(ticketPriority)) {
    const error = new Error("Invalid priority.");
    error.statusCode = 400;
    throw error;
  }

  // Generate ticket code
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM support_tickets`);
  const ticketCode = `#TK-${1022 + Number(total || 0)}`;

  const attachmentUrl = file ? `/uploads/tickets/${file.filename}` : null;

  const [result] = await db.query(
    `
      INSERT INTO support_tickets (
        company_id, user_id, ticket_code, category, request_type,
        subject, priority, status, description, attachment
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?)
    `,
    [companyId, userId, ticketCode, category, requestType, subject.trim(), ticketPriority, description.trim(), attachmentUrl]
  );

  // Get created ticket
  const [createdTicket] = await db.query(
    `
      SELECT
        st.id,
        st.ticket_code AS id,
        st.company_id,
        st.user_id,
        st.category,
        st.request_type AS type,
        st.subject,
        st.priority,
        st.status,
        st.description,
        st.attachment,
        DATE_FORMAT(st.created_at, '%d %b %Y • %h:%i %p') AS created_at,
        DATE_FORMAT(st.updated_at, '%d %b %Y • %h:%i %p') AS updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM support_tickets st
      LEFT JOIN users u ON u.id = st.user_id
      WHERE st.id = ?
    `,
    [result.insertId]
  );

  return createdTicket[0];
}

async function updateTicketStatus(companyId, role, ticketId, status, resolutionNote) {
  if (role !== 'admin' && role !== 'super_admin') {
    const error = new Error("Only admins can update ticket status.");
    error.statusCode = 403;
    throw error;
  }

  const validStatuses = ["Open", "In Progress", "Waiting for Customer", "Resolved", "Closed"];
  if (!validStatuses.includes(status)) {
    const error = new Error("Invalid status.");
    error.statusCode = 400;
    throw error;
  }

  const [ticket] = await db.query(
    `SELECT id, status FROM support_tickets WHERE id = ? AND company_id = ?`,
    [ticketId, companyId]
  );

  if (ticket.length === 0) {
    const error = new Error("Ticket not found.");
    error.statusCode = 404;
    throw error;
  }

  await db.query(
    `
      UPDATE support_tickets
      SET status = ?, resolution_note = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [status, resolutionNote || null, ticketId]
  );

  if (status === "Resolved" || status === "Closed") {
    await db.query(
      `
        UPDATE support_tickets
        SET resolved_at = NOW()
        WHERE id = ?
      `,
      [ticketId]
    );
  }

  return { id: ticketId, status };
}

async function cancelTicket(companyId, role, userId, ticketId) {
  const isAdmin = role === 'admin' || role === 'super_admin';

  // Check if ticket exists and user owns it (or is admin)
  let query = `SELECT id, status, user_id FROM support_tickets WHERE id = ?`;
  const params = [ticketId];

  if (!isAdmin) {
    query += ` AND user_id = ? AND company_id = ?`;
    params.push(userId, companyId);
  }

  const [ticket] = await db.query(query, params);

  if (ticket.length === 0) {
    const error = new Error("Ticket not found or you don't have permission.");
    error.statusCode = 404;
    throw error;
  }

  const currentTicket = ticket[0];

  // Can only cancel if status is Open or Waiting for Customer
  if (!isAdmin && !["Open", "Waiting for Customer"].includes(currentTicket.status)) {
    const error = new Error("Only Open or Waiting tickets can be cancelled.");
    error.statusCode = 400;
    throw error;
  }

  await db.query(
    `
      UPDATE support_tickets
      SET status = 'Closed', updated_at = NOW()
      WHERE id = ?
    `,
    [ticketId]
  );

  return { id: ticketId, status: "Closed" };
}

async function addTicketReply(companyId, role, userId, ticketId, message, file) {
  if (!message || !message.trim()) {
    const error = new Error("Message is required.");
    error.statusCode = 400;
    throw error;
  }

  const isAdmin = role === 'admin' || role === 'super_admin';

  // Check if ticket exists
  let query = `SELECT id, status FROM support_tickets WHERE id = ?`;
  const params = [ticketId];

  if (!isAdmin) {
    query += ` AND user_id = ? AND company_id = ?`;
    params.push(userId, companyId);
  }

  const [ticket] = await db.query(query, params);

  if (ticket.length === 0) {
    const error = new Error("Ticket not found or you don't have permission.");
    error.statusCode = 404;
    throw error;
  }

  // If ticket is closed, don't allow replies
  if (ticket[0].status === "Closed") {
    const error = new Error("Cannot reply to a closed ticket.");
    error.statusCode = 400;
    throw error;
  }

  const attachmentUrl = file ? `/uploads/tickets/${file.filename}` : null;

  await db.query(
    `
      INSERT INTO ticket_replies (
        ticket_id, user_id, message, attachment, is_admin
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [ticketId, userId, message.trim(), attachmentUrl, isAdmin ? 1 : 0]
  );

  // Update ticket status to "In Progress" if it was "Open" or "Waiting for Customer" and admin replied
  if (isAdmin && ["Open", "Waiting for Customer"].includes(ticket[0].status)) {
    await db.query(
      `
        UPDATE support_tickets
        SET status = 'In Progress', updated_at = NOW()
        WHERE id = ?
      `,
      [ticketId]
    );
  }

  // If user replies to "Waiting for Customer" or "In Progress", set back to "In Progress"
  if (!isAdmin && ["Waiting for Customer", "In Progress"].includes(ticket[0].status)) {
    await db.query(
      `
        UPDATE support_tickets
        SET status = 'In Progress', updated_at = NOW()
        WHERE id = ?
      `,
      [ticketId]
    );
  }

  return { id: ticketId, message: message.trim() };
}

module.exports = {
  getTicketStats,
  getTickets,
  getTicketById,
  createTicket,
  updateTicketStatus,
  cancelTicket,
  addTicketReply,
};