const billingService = require('../services/billingService');

async function getBillingOverview(req, res) {
  const data = await billingService.getBillingOverview(req.user.companyId);
  res.json({ success: true, ...data });
}

async function getInvoiceDetails(req, res) {
  const data = await billingService.getInvoiceDetails(req.user.companyId, req.params.id);
  res.json({ success: true, data });
}

async function payWithCredit(req, res) {
  const result = await billingService.payWithCredit(req.user.companyId, req.params.id);
  res.json(result);
}

async function payWithBkash(req, res) {
  const bkashData = await billingService.initiateBkashPayment(req.user.companyId, req.params.id);
  res.json({ success: true, ...bkashData });
}

module.exports = { getBillingOverview, getInvoiceDetails, payWithCredit, payWithBkash };