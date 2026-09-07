const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/subscriptionController');

// Public routes
router.get('/plans', asyncHandler(ctrl.listPlans));

// User routes (authenticated)
router.get('/me', requireAuth, asyncHandler(ctrl.getMySubscription));
router.post('/subscribe', requireAuth, asyncHandler(ctrl.initiateSubscription));

// bKash callback
router.get('/bkash/callback', asyncHandler(ctrl.bkashCallback));

// Admin routes
router.get('/admin/all', requireAuth, requireAdmin, asyncHandler(ctrl.getAllSubscriptions));
router.get('/admin/stats', requireAuth, requireAdmin, asyncHandler(ctrl.getSubscriptionStats));
router.get('/admin/:id', requireAuth, requireAdmin, asyncHandler(ctrl.getSubscriptionById));

module.exports = router;