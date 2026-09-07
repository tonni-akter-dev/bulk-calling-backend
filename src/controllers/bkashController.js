// src/controllers/bkashController.js
const { createPayment, executePayment, queryPayment } = require('../services/bkashService');
const walletService = require('../services/walletService');
const { v4: uuidv4 } = require('uuid');

// In-memory store for pending payments (use Redis for production)
const pendingPayments = new Map();

exports.createPayment = async (req, res) => {
  try {
    const { amount } = req.body;
    const companyId = req.user?.companyId || req.body.companyId || 1; // Get from auth
    
    // Validate amount
    if (!amount || amount < 20 || amount > 1000000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount. Must be between 20 and 1,000,000 TK'
      });
    }

    // Generate unique invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    // Call bKash API
    const paymentResponse = await createPayment({
      amount: amount,
      invoiceNumber: invoiceNumber,
      callbackURL: process.env.BKASH_CALLBACK_URL
    });

    if (paymentResponse.statusCode === '0000') {
      // Store payment info
      pendingPayments.set(paymentResponse.paymentID, {
        companyId,
        amount,
        invoiceNumber,
        status: 'pending',
        created: Date.now()
      });

      // Also store in database
      await walletService.createPendingPayment(
        companyId,
        paymentResponse.paymentID,
        amount,
        invoiceNumber
      );

      return res.json({
        success: true,
        paymentID: paymentResponse.paymentID,
        bkashURL: `https://www.bkash.com/checkout/tokenized/pay?id=${paymentResponse.paymentID}`,
        message: 'Payment created successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: paymentResponse.statusMessage || 'Failed to create payment'
      });
    }
  } catch (error) {
    console.error('Create payment error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Payment creation failed'
    });
  }
};

exports.callback = async (req, res) => {
  try {
    const { paymentID, status } = req.body;
    
    console.log('bKash Callback:', { paymentID, status });

    if (status === 'success' || status === 'Completed') {
      // Execute payment
      const executeResult = await executePayment(paymentID);
      
      if (executeResult.transactionStatus === 'Completed') {
        // Get pending payment info
        const pendingPayment = pendingPayments.get(paymentID) || 
                              await walletService.getPendingPayment(paymentID);
        
        if (pendingPayment) {
          // Add credit to company's wallet
          await walletService.addBalance(
            pendingPayment.companyId,
            pendingPayment.amount,
            'bKash',
            paymentID
          );
          
          // Update payment status
          await walletService.updatePaymentStatus(paymentID, 'completed');
          
          // Clean up
          pendingPayments.delete(paymentID);

          // Redirect to success page
          const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
          return res.redirect(`${frontendURL}/credit?success=true&amount=${pendingPayment.amount}`);
        }
      }
    }

    // Payment failed or canceled
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendURL}/credit?success=false&error=Payment failed`);
  } catch (error) {
    console.error('Callback error:', error);
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendURL}/credit?success=false&error=${encodeURIComponent(error.message)}`);
  }
};

exports.queryPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const result = await queryPayment(paymentId);
    
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Query payment error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};