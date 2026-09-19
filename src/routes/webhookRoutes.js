const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const ctrl = require("../controllers/campaignController");

// IPCall sends POST — but we accept GET too for safety
router.post("/voice-status", asyncHandler(ctrl.voiceWebhook));
router.get("/voice-status", asyncHandler(ctrl.voiceWebhook));

module.exports = router;