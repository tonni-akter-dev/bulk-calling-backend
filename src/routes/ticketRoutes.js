const express = require("express");
const router = express.Router();
const multer = require("multer");

const { requireAuth, requireAdmin } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const ctrl = require("../controllers/ticketController");

const upload = multer({
  dest: "uploads/tickets/",
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(requireAuth);
router.get("/stats", asyncHandler(ctrl.getTicketStats));
router.get("/", asyncHandler(ctrl.getTickets))
router.get("/:id", asyncHandler(ctrl.getTicketById));
router.post("/", upload.single("attachment"), asyncHandler(ctrl.createTicket));
router.patch("/:id/status", requireAdmin, asyncHandler(ctrl.updateTicketStatus));
router.patch("/:id/cancel", asyncHandler(ctrl.cancelTicket));
router.post("/:id/reply", upload.single("attachment"), asyncHandler(ctrl.addTicketReply));

module.exports = router;