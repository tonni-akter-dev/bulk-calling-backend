const express = require("express");
const router = express.Router();
const multer = require("multer");

const { requireAuth } = require("../middleware/auth");

const asyncHandler = require("../utils/asyncHandler");
const ctrl = require("../controllers/ticketController");

const upload = multer({
  dest: "uploads/tickets/",
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

/* ============================================================
   AUTH
============================================================ */

router.use(requireAuth);

/* ============================================================
   TICKET STATS
============================================================ */

router.get(
  "/stats",
  asyncHandler(ctrl.getTicketStats)
);

/* ============================================================
   GET TICKETS
============================================================ */

router.get(
  "/",
  asyncHandler(ctrl.getTickets)
);

/* ============================================================
   CREATE TICKET
============================================================ */

router.post(
  "/",
  upload.single("attachment"),
  asyncHandler(ctrl.createTicket)
);

module.exports = router;