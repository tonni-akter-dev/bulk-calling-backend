const campaignService = require("../services/campaignService");
const walletService = require("../services/walletService");

async function launchCampaign(req, res) {
  try {
    const result = await campaignService.launchBulkCampaign(
      req.user.companyId,
      req.user.userId,
      {
        name: req.body.name,
        targetNumbers: req.body.targetNumbers,
        audioFile: req.file,
        audioFileId: req.body.audioFileId,
      },
    );

    const balance = await walletService.getBalance(req.user.companyId);
    const availableCalls = await walletService.getAvailableCallCount(
      req.user.companyId,
    );

    res.status(201).json({
      success: true,
      message: "Bulk calling launched successfully",
      data: result,
      wallet: {
        balance: Number(balance?.wallet_balance_bdt || 0),
        ratePerMinute: Number(balance?.rate_per_minute_bdt || 0),
        availableCalls,
      },
    });
  } catch (error) {
    console.error("Launch campaign error:", error);
    if (error.statusCode === 402 || error.message.includes("Insufficient")) {
      return res.status(402).json({
        success: false,
        message: error.message,
        error: "INSUFFICIENT_BALANCE",
        available: error.available || 0,
        required: error.required || 0,
        availableCalls: error.availableCalls || 0,
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || "Failed to launch campaign",
    });
  }
}

// ============================================================
// IPCALL WEBHOOK HANDLER
// ============================================================
async function voiceWebhook(req, res) {
  console.log("====================================");
  console.log("[IPCALL WEBHOOK] HIT");
  console.log("METHOD:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("QUERY:", JSON.stringify(req.query));
  console.log("BODY:", JSON.stringify(req.body));
  console.log("====================================");

  try {
    // ✅ Merge query + body (IPCall sends POST body, but merge for safety)
    const payload = { ...(req.query || {}), ...(req.body || {}) };

    const result = await campaignService.handleVoiceWebhook(payload);

    console.log("[IPCALL WEBHOOK] RESULT:", result);

    return res.status(200).json({
      received: true,
      ...result,
    });
  } catch (err) {
    console.error("[IPCALL WEBHOOK] ERROR:", err);

    // Always return 200 so IPCall doesn't retry endlessly
    return res.status(200).json({
      received: true,
      error: err.message,
    });
  }
}

async function getLiveLogs(req, res) {
  const data = await campaignService.getLiveCallLogs(
    req.user.companyId,
    req.user.role,
  );
  res.json({ success: true, ...data });
}

async function getAllCampaigns(req, res) {
  const campaigns = await campaignService.getAllCampaigns(
    req.user.companyId,
    req.user.role,
  );
  res.json({ success: true, data: campaigns });
}

async function getCampaignById(req, res) {
  const { id } = req.params;
  const campaign = await campaignService.getCampaignById(
    req.user.companyId,
    req.user.role,
    id,
  );
  res.json({ success: true, data: campaign });
}

async function updateCampaignStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const result = await campaignService.updateCampaignStatus(
    req.user.companyId,
    req.user.role,
    id,
    status,
  );
  res.json({
    success: true,
    message: `Campaign status updated to ${status}`,
    data: result,
  });
}

async function deleteCampaign(req, res) {
  const { id } = req.params;
  await campaignService.deleteCampaign(req.user.companyId, req.user.role, id);
  res.json({ success: true, message: "Campaign deleted successfully" });
}

async function getCampaignStats(req, res) {
  const stats = await campaignService.getCampaignStats(
    req.user.companyId,
    req.user.role,
  );
  res.json({ success: true, data: stats });
}

async function getCallHistory(req, res) {
  try {
    const data = await campaignService.getCallHistory(
      req.user.companyId,
      req.user.role,
      {
        page: req.query.page,
        per_page: req.query.per_page,
        status: req.query.status,
        mobile: req.query.mobile,
        campaign_id: req.query.campaign_id,
        date_from: req.query.date_from,
        date_to: req.query.date_to,
      },
    );

    res.json({ success: true, ...data });
  } catch (err) {
    console.error("getCallHistory error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getAllCallLogs(req, res) {
  try {
    const ipcallSync = require("../services/ipcallSyncService");

    const data = await ipcallSync.getIpcallCallLogs({
      mobile: req.query.mobile,
      status: req.query.status,
      agent: req.query.agent,
      call_type: req.query.call_type,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      page: req.query.page,
      per_page: req.query.per_page,
    });

    res.json({ success: true, ...data });
  } catch (err) {
    console.error("getAllCallLogs error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to load call logs",
    });
  }
}

module.exports = {
  launchCampaign,
  getLiveLogs,
  getAllCampaigns,
  getCampaignById,
  updateCampaignStatus,
  deleteCampaign,
  getCampaignStats,
  voiceWebhook,
  getCallHistory,
  getAllCallLogs,
};