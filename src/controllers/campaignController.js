const campaignService = require('../services/campaignService');

async function launchCampaign(req, res) {
  const result = await campaignService.launchBulkCampaign(
    req.user.companyId,
    req.user.userId,
    {
      name: req.body.name,
      targetNumbers: req.body.targetNumbers,
      audioFile: req.file,
    }
  );
  res.status(201).json({ success: true, message: 'Bulk calling launched successfully', data: result });
}

async function getLiveLogs(req, res) {
  const data = await campaignService.getLiveCallLogs(req.user.companyId);
  res.json({ success: true, ...data });
}

module.exports = { launchCampaign, getLiveLogs };