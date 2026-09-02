const creditService = require('../services/creditService');

async function getWalletOverview(req, res) {
  const data = await creditService.getWalletOverview(req.user.companyId);
  res.json({ success: true, ...data });
}

async function getTopUpHistory(req, res) {
  const history = await creditService.getTopUpHistory(req.user.companyId, req.query);
  res.json({ success: true, data: history });
}

async function initiateTopUp(req, res) {
  const result = await creditService.initiateTopUp(req.user.companyId, req.body);
  res.json({ success: true, ...result });
}

module.exports = { getWalletOverview, getTopUpHistory, initiateTopUp };