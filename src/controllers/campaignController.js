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
  res.status(201).json({ 
    success: true, 
    message: 'Bulk calling launched successfully', 
    data: result 
  });
}

async function getLiveLogs(req, res) {
  const data = await campaignService.getLiveCallLogs(req.user.companyId, req.user.role);
  res.json({ success: true, ...data });
}

async function getAllCampaigns(req, res) {
  const campaigns = await campaignService.getAllCampaigns(req.user.companyId, req.user.role);
  res.json({ success: true, data: campaigns });
}

async function getCampaignById(req, res) {
  const { id } = req.params;
  const campaign = await campaignService.getCampaignById(req.user.companyId, req.user.role, id);
  res.json({ success: true, data: campaign });
}

async function updateCampaignStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const result = await campaignService.updateCampaignStatus(req.user.companyId, req.user.role, id, status);
  res.json({ 
    success: true, 
    message: `Campaign status updated to ${status}`, 
    data: result 
  });
}

async function deleteCampaign(req, res) {
  const { id } = req.params;
  await campaignService.deleteCampaign(req.user.companyId, req.user.role, id);
  res.json({ 
    success: true, 
    message: 'Campaign deleted successfully' 
  });
}

async function getCampaignStats(req, res) {
  const stats = await campaignService.getCampaignStats(req.user.companyId, req.user.role);
  res.json({ success: true, data: stats });
}

module.exports = {
  launchCampaign,
  getLiveLogs,
  getAllCampaigns,
  getCampaignById,
  updateCampaignStatus,
  deleteCampaign,
  getCampaignStats
};