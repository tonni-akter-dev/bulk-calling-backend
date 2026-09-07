// src/routes/bkashRoutes.js
const express = require('express');
const router = express.Router();
const bkashController = require('../controllers/bkashController');

// Create payment
router.post('/create-payment', bkashController.createPayment);

// Execute payment (callback)
router.post('/callback', bkashController.callback);

// Query payment status
router.get('/status/:paymentId', bkashController.queryPayment);

module.exports = router;