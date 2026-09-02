const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/subscriptionController');

router.get('/plans', asyncHandler(ctrl.listPlans));
router.get('/me', requireAuth, asyncHandler(ctrl.getMySubscription));
router.post('/subscribe', requireAuth, asyncHandler(ctrl.initiateSubscription));

router.get('/bkash/callback', asyncHandler(ctrl.bkashCallback));

module.exports = router;