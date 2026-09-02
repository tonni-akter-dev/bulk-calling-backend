const express = require('express');
const router = express.Router();
const { requireAuth, requireActiveSubscription } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/dashboardController');

router.use(requireAuth, requireActiveSubscription);

router.get('/stats', asyncHandler(ctrl.getDashboardStats));

module.exports = router;