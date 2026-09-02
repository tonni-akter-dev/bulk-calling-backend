const express = require('express');
const router = express.Router();
const { requireAuth, requireActiveSubscription } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/billingController');

router.use(requireAuth, requireActiveSubscription);

// GET Billing overview & invoice list
router.get('/overview', asyncHandler(ctrl.getBillingOverview));

// GET Invoice details by ID
router.get('/invoices/:id', asyncHandler(ctrl.getInvoiceDetails));

// POST Pay invoice using wallet credit ("Pay with Credit" button)
router.post('/invoices/:id/pay-credit', asyncHandler(ctrl.payWithCredit));

// POST Initiate bKash Gateway Payment ("Pay Now!" button)
router.post('/invoices/:id/pay-bkash', asyncHandler(ctrl.payWithBkash));

module.exports = router;