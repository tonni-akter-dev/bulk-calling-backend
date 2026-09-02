const express = require("express");

const router = express.Router();

const asyncHandler = require("../utils/asyncHandler");
const controller = require("../controllers/planController");

/* ============================================================
   GET ALL PLANS
   GET /api/plans
============================================================ */

router.get(
  "/",
  asyncHandler(controller.getPlans)
);

/* ============================================================
   GET SINGLE PLAN
   GET /api/plans/:id
============================================================ */

router.get(
  "/:id",
  asyncHandler(controller.getPlan)
);

module.exports = router;