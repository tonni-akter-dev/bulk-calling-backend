// const campaignService = require('../services/campaignService');

// async function launchCampaign(req, res) {
//   const result = await campaignService.launchBulkCampaign(
//     req.user.companyId,
//     req.user.userId,
//     {
//       name: req.body.name,
//       targetNumbers: req.body.targetNumbers,
//       audioFile: req.file,
//     }
//   );
//   res.status(201).json({ 
//     success: true, 
//     message: 'Bulk calling launched successfully', 
//     data: result 
//   });
// }

// async function getLiveLogs(req, res) {
//   const data = await campaignService.getLiveCallLogs(req.user.companyId, req.user.role);
//   res.json({ success: true, ...data });
// }

// async function getAllCampaigns(req, res) {
//   const campaigns = await campaignService.getAllCampaigns(req.user.companyId, req.user.role);
//   res.json({ success: true, data: campaigns });
// }

// async function getCampaignById(req, res) {
//   const { id } = req.params;
//   const campaign = await campaignService.getCampaignById(req.user.companyId, req.user.role, id);
//   res.json({ success: true, data: campaign });
// }

// async function updateCampaignStatus(req, res) {
//   const { id } = req.params;
//   const { status } = req.body;
//   const result = await campaignService.updateCampaignStatus(req.user.companyId, req.user.role, id, status);
//   res.json({ 
//     success: true, 
//     message: `Campaign status updated to ${status}`, 
//     data: result 
//   });
// }

// async function deleteCampaign(req, res) {
//   const { id } = req.params;
//   await campaignService.deleteCampaign(req.user.companyId, req.user.role, id);
//   res.json({ 
//     success: true, 
//     message: 'Campaign deleted successfully' 
//   });
// }

// async function getCampaignStats(req, res) {
//   const stats = await campaignService.getCampaignStats(req.user.companyId, req.user.role);
//   res.json({ success: true, data: stats });
// }

// module.exports = {
//   launchCampaign,
//   getLiveLogs,
//   getAllCampaigns,
//   getCampaignById,
//   updateCampaignStatus,
//   deleteCampaign,
//   getCampaignStats
// };
// src/controllers/campaignController.js
const campaignService = require('../services/campaignService');
const walletService = require('../services/walletService');

async function launchCampaign(req, res) {
  try {
    const result = await campaignService.launchBulkCampaign(
      req.user.companyId,
      req.user.userId,
      {
        name: req.body.name,
        targetNumbers: req.body.targetNumbers,
        audioFile: req.file,
      }
    );

    // Get updated balance info
    const balance = await walletService.getBalance(req.user.companyId);
    const availableCalls = await walletService.getAvailableCallCount(req.user.companyId);

    res.status(201).json({
      success: true,
      message: 'Bulk calling launched successfully',
      data: result,
      wallet: {
        balance: Number(balance?.wallet_balance_bdt || 0),
        ratePerMinute: Number(balance?.rate_per_minute_bdt || 0),
        availableCalls: availableCalls
      }
    });
  } catch (error) {
    console.error('Launch campaign error:', error);
    
    // Handle insufficient balance error
    if (error.statusCode === 402 || error.message.includes('Insufficient')) {
      return res.status(402).json({
        success: false,
        message: error.message,
        error: 'INSUFFICIENT_BALANCE',
        available: error.available || 0,
        required: error.required || 0,
        availableCalls: error.availableCalls || 0
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to launch campaign'
    });
  }
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