// src/controllers/walletController.js
const walletService = require('../services/walletService');
const bkashService = require('../services/bkashService');

exports.getBalance = async (req, res) => {
  try {
    const companyId = req.user?.companyId || 2;
    const balance = await walletService.getBalance(companyId);
    
    res.json({
      balance: Number(balance?.wallet_balance_bdt || 0),
      currency: 'BDT',
      isActive: true,
      ratePerMinute: Number(balance?.rate_per_minute_bdt || 0)
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const companyId = req.user?.companyId || 2;
    const limit = parseInt(req.query.limit) || 50;
    
    const transactions = await walletService.listTransactions(companyId, limit);
    res.json(transactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.initiateTopup = async (req, res) => {
  try {
    const { amount } = req.body;
    const companyId = req.user?.companyId || 2;
    
    console.log('💰 Initiating topup:', { companyId, amount });

    if (!amount || amount < 20 || amount > 1000000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount. Must be between 20 and 1,000,000 TK'
      });
    }

    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    const paymentResponse = await bkashService.createPayment({
      amount: amount,
      invoiceNumber: invoiceNumber,
      callbackURL: process.env.BKASH_CALLBACK_URL
    });

    console.log('📦 Payment Response:', paymentResponse);

    if (paymentResponse.statusCode === '0000' && paymentResponse.paymentID) {
      // Store in memory
      if (!global.pendingPayments) {
        global.pendingPayments = new Map();
      }
      global.pendingPayments.set(paymentResponse.paymentID, {
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

      // Return the bkashURL from the response
      return res.json({
        success: true,
        paymentID: paymentResponse.paymentID,
        bkashURL: paymentResponse.bkashURL || `https://sandbox.payment.bkash.com/?paymentId=${paymentResponse.paymentID}`,
        message: 'Payment initiated successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: paymentResponse.statusMessage || 'Failed to create payment'
      });
    }
  } catch (error) {
    console.error('❌ Initiate topup error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to initiate payment'
    });
  }
};

exports.bkashCallback = async (req, res) => {
  try {
    const { paymentID, status } = req.body;
    
    console.log('📞 bKash Callback received:', { paymentID, status });

    if (status === 'success' || status === 'Completed') {
      const executeResult = await bkashService.executePayment(paymentID);
      
      if (executeResult.transactionStatus === 'Completed') {
        let pendingPayment = null;
        
        if (global.pendingPayments && global.pendingPayments.has(paymentID)) {
          pendingPayment = global.pendingPayments.get(paymentID);
        }
        
        if (!pendingPayment) {
          pendingPayment = await walletService.getPendingPayment(paymentID);
        }
        
        if (pendingPayment) {
          await walletService.addBalance(
            pendingPayment.companyId,
            pendingPayment.amount,
            'bKash',
            paymentID
          );
          
          await walletService.updatePaymentStatus(paymentID, 'completed');
          
          if (global.pendingPayments) {
            global.pendingPayments.delete(paymentID);
          }

          const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
          return res.redirect(`${frontendURL}/credit?success=true&amount=${pendingPayment.amount}`);
        }
      }
    }

    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendURL}/credit?success=false&error=Payment failed or canceled`);
  } catch (error) {
    console.error('❌ bKash callback error:', error);
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendURL}/credit?success=false&error=${encodeURIComponent(error.message)}`);
  }
};

exports.checkPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const result = await bkashService.queryPayment(paymentId);
    
    res.json({
      success: true,
      status: result.transactionStatus || 'pending',
      amount: result.amount || 0
    });
  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};