const express = require('express');
const router = express.Router();
const { requireAuth, requireActiveSubscription } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/creditController');

router.use(requireAuth, requireActiveSubscription);

// GET Wallet current credit & monthly stats summary
router.get('/overview', asyncHandler(ctrl.getWalletOverview));

// GET Credit Top-up History list with tab filter (IP Recharge, Credit Top-up, SMS Usage, etc.)
router.get('/history', asyncHandler(ctrl.getTopUpHistory));

// POST Initiate Top-up using bKash Gateway
router.post('/topup', asyncHandler(ctrl.initiateTopUp));

module.exports = router;