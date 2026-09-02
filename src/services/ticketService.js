const db = require("../config/db");

/* ============================================================
   GET TICKET STATS
============================================================ */

async function getTicketStats(companyId) {
  const [[stats]] = await db.query(
    `
      SELECT
        COUNT(*) AS total,

        SUM(
          CASE
            WHEN status = 'Open' THEN 1
            ELSE 0
          END
        ) AS open,

        SUM(
          CASE
            WHEN status = 'In Progress' THEN 1
            ELSE 0
          END
        ) AS inProgress,

        SUM(
          CASE
            WHEN status = 'Resolved' THEN 1
            ELSE 0
          END
        ) AS resolved

      FROM support_tickets

      WHERE company_id = ?
    `,
    [companyId]
  );

  return {
    totalTickets: String(stats?.total || 0).padStart(2, "0"),
    openTickets: String(stats?.open || 0).padStart(2, "0"),
    inProgress: String(stats?.inProgress || 0).padStart(2, "0"),
    resolved: String(stats?.resolved || 0).padStart(2, "0"),
  };
}

/* ============================================================
   GET TICKETS
============================================================ */

async function getTickets(
  companyId,
  {
    search = "",
    category = "",
    status = "",
    page = 1,
    limit = 10,
  }
) {
  const pageNum = Math.max(
    parseInt(page, 10) || 1,
    1
  );

  const limitNum = Math.min(
    Math.max(
      parseInt(limit, 10) || 10,
      1
    ),
    100
  );

  const offset = (pageNum - 1) * limitNum;

  /* ============================================================
     WHERE CONDITIONS
  ============================================================ */

  const whereConditions = [
    "st.company_id = ?",
  ];

  const params = [companyId];

  /* ============================================================
     SEARCH
  ============================================================ */

  if (search && search.trim()) {
    const searchPattern = `%${search.trim()}%`;

    whereConditions.push(`
      (
        st.ticket_code LIKE ?
        OR st.subject LIKE ?
        OR st.category LIKE ?
        OR st.request_type LIKE ?
        OR st.status LIKE ?
        OR st.priority LIKE ?
        OR u.name LIKE ?
        OR u.email LIKE ?
      )
    `);

    params.push(
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern
    );
  }

  /* ============================================================
     CATEGORY FILTER
  ============================================================ */

  if (category && category.trim()) {
    whereConditions.push(
      "st.category = ?"
    );

    params.push(category.trim());
  }

  /* ============================================================
     STATUS FILTER
  ============================================================ */

  if (status && status.trim()) {
    whereConditions.push(
      "st.status = ?"
    );

    params.push(status.trim());
  }

  const whereClause =
    whereConditions.join(" AND ");

  /* ============================================================
     TOTAL COUNT
  ============================================================ */

  const [[countResult]] = await db.query(
    `
      SELECT COUNT(*) AS total

      FROM support_tickets st

      LEFT JOIN users u
        ON u.id = st.user_id

      WHERE ${whereClause}
    `,
    params
  );

  /* ============================================================
     GET TICKETS + USER DETAILS
  ============================================================ */

  const [rows] = await db.query(
    `
      SELECT

        /* Ticket */
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

        DATE_FORMAT(
          st.created_at,
          '%d %b %Y'
        ) AS date,

        DATE_FORMAT(
          st.created_at,
          '%Y-%m-%d %H:%i:%s'
        ) AS created_at,

        DATE_FORMAT(
          st.updated_at,
          '%Y-%m-%d %H:%i:%s'
        ) AS updated_at,

        /* User */
        u.id AS user_detail_id,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role

      FROM support_tickets st

      LEFT JOIN users u
        ON u.id = st.user_id

      WHERE ${whereClause}

      ORDER BY st.created_at DESC

      LIMIT ? OFFSET ?
    `,
    [
      ...params,
      limitNum,
      offset,
    ]
  );

  /* ============================================================
     FORMAT TICKETS
  ============================================================ */

  const tickets = rows.map((ticket) => ({
    id: ticket.id,

    ticketId: ticket.ticket_id,

    companyId: ticket.company_id,

    user: {
      id: ticket.user_detail_id,
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

    date: ticket.date,

    createdAt: ticket.created_at,

    updatedAt: ticket.updated_at,
  }));

  /* ============================================================
     PAGINATION
  ============================================================ */

  const total = Number(
    countResult?.total || 0
  );

  const totalPages = Math.ceil(
    total / limitNum
  );

  return {
    tickets,

    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,

      hasNextPage:
        pageNum < totalPages,

      hasPreviousPage:
        pageNum > 1,
    },
  };
}

/* ============================================================
   CREATE TICKET
============================================================ */

async function createTicket(
  companyId,
  userId,
  data,
  file
) {
  const {
    category,
    requestType,
    subject,
    priority,
    description,
  } = data;

  /* ============================================================
     VALIDATION
  ============================================================ */

  if (!category) {
    const error = new Error(
      "Please select a category."
    );

    error.statusCode = 400;

    throw error;
  }

  if (!requestType) {
    const error = new Error(
      "Please select a type of request."
    );

    error.statusCode = 400;

    throw error;
  }

  if (!subject || !subject.trim()) {
    const error = new Error(
      "Subject is required."
    );

    error.statusCode = 400;

    throw error;
  }

  if (!description || !description.trim()) {
    const error = new Error(
      "Please describe your issue."
    );

    error.statusCode = 400;

    throw error;
  }

  /* ============================================================
     VALID CATEGORIES
  ============================================================ */

  const allowedCategories = [
    "Complaint",
    "Request",
    "Billing",
  ];

  if (
    !allowedCategories.includes(category)
  ) {
    const error = new Error(
      "Invalid ticket category."
    );

    error.statusCode = 400;

    throw error;
  }

  /* ============================================================
     VALID REQUEST TYPES
  ============================================================ */

  const requestTypes = {
    Complaint: [
      "Extension Disconnect",
      "Call Drop",
      "Billing",
      "Bulk Voice Call",
      "Voice Quality Issue",
    ],

    Request: [
      "Extension Remove Request",
      "Call Channel",
      "Call Logs Report",
      "Telephone Configuration",
      "Mobile/PC Configuration",
      "API Integration",
    ],

    Billing: [
      "Add Credit",
      "Payment Issue",
      "Invoice Request",
      "Balance Issue",
    ],
  };

  if (
    !requestTypes[category] ||
    !requestTypes[category].includes(
      requestType
    )
  ) {
    const error = new Error(
      "Invalid request type for selected category."
    );

    error.statusCode = 400;

    throw error;
  }

  /* ============================================================
     VALID PRIORITY
  ============================================================ */

  const allowedPriorities = [
    "Low",
    "Medium",
    "High",
  ];

  const ticketPriority =
    priority || "Low";

  if (
    !allowedPriorities.includes(
      ticketPriority
    )
  ) {
    const error = new Error(
      "Invalid priority."
    );

    error.statusCode = 400;

    throw error;
  }

  /* ============================================================
     VALID USER
  ============================================================ */

  if (!userId) {
    const error = new Error(
      "Authenticated user not found."
    );

    error.statusCode = 401;

    throw error;
  }

  /* ============================================================
     CHECK USER EXISTS
  ============================================================ */

  const [[user]] = await db.query(
    `
      SELECT
        id,
        name,
        email,
        role,
        company_id

      FROM users

      WHERE id = ?
      AND company_id = ?

      LIMIT 1
    `,
    [
      userId,
      companyId,
    ]
  );

  if (!user) {
    const error = new Error(
      "User does not belong to this company."
    );

    error.statusCode = 403;

    throw error;
  }

  /* ============================================================
     GENERATE TICKET CODE
  ============================================================ */

  const [[{ total }]] =
    await db.query(
      `
        SELECT COUNT(*) AS total

        FROM support_tickets
      `
    );

  const ticketCode =
    `#TK-${1022 + Number(total || 0)}`;

  /* ============================================================
     ATTACHMENT
  ============================================================ */

  const attachmentUrl = file
    ? `/uploads/tickets/${file.filename}`
    : null;

  /* ============================================================
     INSERT TICKET
  ============================================================ */

  const [result] = await db.query(
    `
      INSERT INTO support_tickets (
        company_id,
        user_id,
        ticket_code,
        category,
        request_type,
        subject,
        priority,
        status,
        description,
        attachment
      )

      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
      )
    `,
    [
      companyId,
      userId,
      ticketCode,
      category,
      requestType,
      subject.trim(),
      ticketPriority,
      "Open",
      description.trim(),
      attachmentUrl,
    ]
  );

  /* ============================================================
     GET CREATED TICKET + USER DETAILS
  ============================================================ */

  const [[createdTicket]] =
    await db.query(
      `
        SELECT

          /* Ticket */
          st.id AS ticket_id,
          st.ticket_code,
          st.company_id,
          st.user_id,

          st.category,
          st.request_type,
          st.subject,
          st.priority,
          st.status,
          st.description,
          st.attachment,

          DATE_FORMAT(
            st.created_at,
            '%Y-%m-%d %H:%i:%s'
          ) AS created_at,

          DATE_FORMAT(
            st.updated_at,
            '%Y-%m-%d %H:%i:%s'
          ) AS updated_at,

          /* User */
          u.id AS user_detail_id,
          u.name AS user_name,
          u.email AS user_email,
          u.role AS user_role

        FROM support_tickets st

        LEFT JOIN users u
          ON u.id = st.user_id

        WHERE st.id = ?

        LIMIT 1
      `,
      [result.insertId]
    );

  /* ============================================================
     RESPONSE
  ============================================================ */

  return {
    id: createdTicket.ticket_code,

    ticketId:
      createdTicket.ticket_id,

    companyId:
      createdTicket.company_id,

    user: {
      id: createdTicket.user_detail_id,
      name: createdTicket.user_name,
      email: createdTicket.user_email,
      role: createdTicket.user_role,
    },

    category:
      createdTicket.category,

    requestType:
      createdTicket.request_type,

    subject:
      createdTicket.subject,

    priority:
      createdTicket.priority,

    status:
      createdTicket.status,

    description:
      createdTicket.description,

    attachment:
      createdTicket.attachment,

    createdAt:
      createdTicket.created_at,

    updatedAt:
      createdTicket.updated_at,
  };
}

/* ============================================================
   EXPORT
============================================================ */

module.exports = {
  getTicketStats,
  getTickets,
  createTicket,
};