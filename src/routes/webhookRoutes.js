// src/routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/campaignController');

// ⚠️ No auth middleware — IP Call BD কে access দিতে হবে
// Security: IP Call BD থেকে আসা IP allow-list করতে পারো (optional)

router.post('/voice-status', asyncHandler(ctrl.voiceWebhook));

module.exports = router;