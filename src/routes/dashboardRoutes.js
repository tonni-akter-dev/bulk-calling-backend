// src/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/dashboardController');

// সব dashboard route এ auth লাগবে
router.use(requireAuth);

// ============================================================
// 🆕 User dashboard — per company (live data, no subscription check)
// ============================================================
router.get('/metrics', asyncHandler(ctrl.getMyDashboard));

// ============================================================
// Super Admin dashboard — aggregated (needs subscription for some reason?)
// ============================================================
router.get('/stats', asyncHandler(ctrl.getDashboardStats));

module.exports = router;