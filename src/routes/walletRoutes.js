const express = require('express');
const router = express.Router();
const { requireAuth, requireActiveSubscription } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/walletController');

router.get('/bkash/callback', asyncHandler(ctrl.bkashCallback));

router.use(requireAuth, requireActiveSubscription);

router.get('/', asyncHandler(ctrl.getBalance));
router.get('/transactions', asyncHandler(ctrl.getTransactions));
router.post('/topup', asyncHandler(ctrl.initiateTopup));

module.exports = router;