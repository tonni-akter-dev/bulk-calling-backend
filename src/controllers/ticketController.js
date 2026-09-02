const ticketService = require("../services/ticketService");

/* ============================================================
   GET /tickets/stats
============================================================ */

async function getTicketStats(req, res) {
  const stats =
    await ticketService.getTicketStats(
      req.user.companyId
    );

  res.json({
    success: true,
    data: stats,
  });
}

/* ============================================================
   GET /tickets
============================================================ */

async function getTickets(req, res) {
  const result =
    await ticketService.getTickets(
      req.user.companyId,
      req.query
    );

  res.json({
    success: true,
    data: result,
  });
}

/* ============================================================
   POST /tickets
============================================================ */

async function createTicket(req, res) {
  console.log(
    "Authenticated User:",
    req.user
  );

  console.log(
    "Ticket Body:",
    req.body
  );

  console.log(
    "Uploaded File:",
    req.file
  );

  const result =
    await ticketService.createTicket(
      req.user.companyId,
      req.user.userId,
      req.body,
      req.file
    );

  res.status(201).json({
    success: true,
    message:
      "Ticket created successfully",
    data: result,
  });
}

/* ============================================================
   EXPORT
============================================================ */

module.exports = {
  getTicketStats,
  getTickets,
  createTicket,
};