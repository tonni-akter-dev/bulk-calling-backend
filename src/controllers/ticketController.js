const ticketService = require("../services/ticketService");

/* ============================================================
   GET /tickets/stats
============================================================ */

async function getTicketStats(req, res) {
  const stats = await ticketService.getTicketStats(
    req.user.companyId,
    req.user.role // Pass role to check if admin or user
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
  const result = await ticketService.getTickets(
    req.user.companyId,
    req.user.role,
    req.query
  );

  res.json({
    success: true,
    data: result,
  });
}

/* ============================================================
   GET /tickets/:id
============================================================ */

async function getTicketById(req, res) {
  const { id } = req.params;

  const ticket = await ticketService.getTicketById(
    req.user.companyId,
    req.user.role,
    req.user.userId,
    id
  );

  res.json({
    success: true,
    data: ticket,
  });
}

/* ============================================================
   POST /tickets
============================================================ */

async function createTicket(req, res) {
  const result = await ticketService.createTicket(
    req.user.companyId,
    req.user.userId,
    req.user.role,
    req.body,
    req.file
  );

  res.status(201).json({
    success: true,
    message: "Ticket created successfully",
    data: result,
  });
}

/* ============================================================
   PATCH /tickets/:id/status
============================================================ */

async function updateTicketStatus(req, res) {
  const { id } = req.params;
  const { status, resolutionNote } = req.body;

  const result = await ticketService.updateTicketStatus(
    req.user.companyId,
    req.user.role,
    id,
    status,
    resolutionNote
  );

  res.json({
    success: true,
    message: "Ticket status updated successfully",
    data: result,
  });
}

/* ============================================================
   PATCH /tickets/:id/cancel
============================================================ */

async function cancelTicket(req, res) {
  const { id } = req.params;

  const result = await ticketService.cancelTicket(
    req.user.companyId,
    req.user.role,
    req.user.userId,
    id
  );

  res.json({
    success: true,
    message: "Ticket cancelled successfully",
    data: result,
  });
}

/* ============================================================
   POST /tickets/:id/reply
============================================================ */

async function addTicketReply(req, res) {
  const { id } = req.params;
  const { message } = req.body;

  const result = await ticketService.addTicketReply(
    req.user.companyId,
    req.user.role,
    req.user.userId,
    id,
    message,
    req.file
  );

  res.json({
    success: true,
    message: "Reply added successfully",
    data: result,
  });
}

/* ============================================================
   EXPORT
============================================================ */

module.exports = {
  getTicketStats,
  getTickets,
  getTicketById,
  createTicket,
  updateTicketStatus,
  cancelTicket,
  addTicketReply,
};