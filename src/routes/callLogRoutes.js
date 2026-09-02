const express = require('express');
const router = express.Router();
const { requireAuth, requireActiveSubscription } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/callLogController');

router.use(requireAuth, requireActiveSubscription);

// GET /api/call-logs?mobile=017...&status=Completed&agent=Rahim&startDate=2026-09-01&endDate=2026-09-01
router.get('/', asyncHandler(ctrl.getCallLogs));

// GET /api/call-logs/export
router.get('/export', asyncHandler(ctrl.exportCallLogs));

module.exports = router;