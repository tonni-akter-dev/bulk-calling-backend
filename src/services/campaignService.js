const db = require('../config/db');
const axios = require('axios');
const wallet = require('./walletService');
const { parseNumbersFromText } = require('../utils/numberParser');

// Launch Bulk Campaign
async function launchBulkCampaign(companyId, userId, { name, targetNumbers, audioFile }) {
  if (!name) throw new Error('Campaign name is required');
  if (!targetNumbers) throw new Error('Target phone numbers are required');
  if (!audioFile) throw new Error('Voice message audio file is required');

  const hasBalance = await wallet.hasEnoughForOneCall(companyId);
  if (!hasBalance) {
    const err = new Error('Insufficient wallet balance or active subscription required');
    err.statusCode = 402;
    throw err;
  }

  const numbersArray = parseNumbersFromText(targetNumbers);
  if (!numbersArray.length) throw new Error('No valid target phone numbers found');

  const publicAudioUrl = `${process.env.BASE_URL}/uploads/audio/${audioFile.filename}`;

  const [audioResult] = await db.query(
    `INSERT INTO audio_files (company_id, original_name, stored_path, public_url) VALUES (?, ?, ?, ?)`,
    [companyId, audioFile.originalname, audioFile.path, publicAudioUrl]
  );

  const [campaignResult] = await db.query(
    `INSERT INTO campaigns (company_id, created_by, name, audio_file_id, total_numbers, status) VALUES (?, ?, ?, ?, ?, 'processing')`,
    [companyId, userId, name, audioResult.insertId, numbersArray.length]
  );
  const campaignId = campaignResult.insertId;

  const numberValues = numbersArray.map((num) => [campaignId, num, 'queued']);
  await db.query(`INSERT INTO campaign_numbers (campaign_id, phone_number, status) VALUES ?`, [numberValues]);

  dispatchThirdPartyCalls(campaignId, companyId, numbersArray, publicAudioUrl).catch((err) =>
    console.error(`Third party dispatch error for campaign ${campaignId}:`, err)
  );

  return { campaignId, totalNumbers: numbersArray.length, status: 'processing' };
}

// Dispatch calls to third-party
async function dispatchThirdPartyCalls(campaignId, companyId, numbers, audioUrl) {
  for (const phone of numbers) {
    try {
      const response = await axios.post(`${process.env.THIRD_PARTY_VOICE_API_URL}/call`, {
        apiKey: process.env.THIRD_PARTY_API_KEY,
        to: phone,
        audioUrl: audioUrl,
        webhookUrl: `${process.env.BASE_URL}/api/webhooks/voice-status`,
      });

      await db.query(
        `UPDATE campaign_numbers SET status = 'ringing', external_call_id = ? WHERE campaign_id = ? AND phone_number = ?`,
        [response.data.callId || null, campaignId, phone]
      );
    } catch (error) {
      await db.query(
        `UPDATE campaign_numbers SET status = 'failed' WHERE campaign_id = ? AND phone_number = ?`,
        [campaignId, phone]
      );
    }
  }
}

// Get live call logs
async function getLiveCallLogs(companyId, role) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  
  let query = `
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN cn.status = 'completed' THEN 1 ELSE 0 END) AS success,
      SUM(CASE WHEN cn.status IN ('ringing', 'in-progress') THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN cn.status IN ('failed', 'busy', 'no-answer') THEN 1 ELSE 0 END) AS failed
    FROM campaign_numbers cn
    JOIN campaigns c ON cn.campaign_id = c.id
  `;
  
  const params = [];
  
  if (!isAdmin) {
    query += ` WHERE c.company_id = ?`;
    params.push(companyId);
  }

  const [[metrics]] = await db.query(query, params);

  let logsQuery = `
    SELECT 
      cn.id,
      cn.phone_number AS phone,
      cn.status,
      cn.duration_seconds AS duration,
      DATE_FORMAT(cn.updated_at, '%h:%i %p') AS time
    FROM campaign_numbers cn
    JOIN campaigns c ON cn.campaign_id = c.id
  `;
  
  if (!isAdmin) {
    logsQuery += ` WHERE c.company_id = ?`;
  }
  
  logsQuery += ` ORDER BY cn.updated_at DESC LIMIT 50`;

  const [logs] = await db.query(logsQuery, params);

  return {
    summary: {
      total: metrics.total || 0,
      success: metrics.success || 0,
      active: metrics.active || 0,
      failed: metrics.failed || 0,
    },
    logs: logs || [],
  };
}

// Get all campaigns (with super admin support)
async function getAllCampaigns(companyId, role) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  
  let query = `
    SELECT 
      c.id,
      c.name,
      c.total_numbers,
      c.status,
      c.created_at,
      u.name AS created_by,
      u.email AS created_by_email,
      u.company_id,
      comp.name AS company_name,
      af.original_name AS audio_file_name,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'completed') AS completed,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('ringing', 'in-progress')) AS active,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('failed', 'busy', 'no-answer')) AS failed,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'queued') AS queued,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id) AS total_processed,
      c.total_numbers - (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id) AS remaining
    FROM campaigns c
    JOIN users u ON u.id = c.created_by
    JOIN companies comp ON comp.id = c.company_id
    LEFT JOIN audio_files af ON af.id = c.audio_file_id
  `;
  
  const params = [];
  
  if (!isAdmin) {
    query += ` WHERE c.company_id = ?`;
    params.push(companyId);
  }
  
  query += ` ORDER BY c.created_at DESC`;

  const [campaigns] = await db.query(query, params);
  return campaigns;
}

// Get campaign stats (with super admin support)
async function getCampaignStats(companyId, role) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  
  let query = `
    SELECT 
      COUNT(*) AS total_campaigns,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS active_campaigns,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_campaigns,
      SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused_campaigns,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_campaigns,
      SUM(total_numbers) AS total_numbers_called,
      SUM(total_numbers) * 0.4 AS credits_used
    FROM campaigns
  `;
  
  const params = [];
  
  if (!isAdmin) {
    query += ` WHERE company_id = ?`;
    params.push(companyId);
  }

  const [[stats]] = await db.query(query, params);

  return {
    totalCampaigns: stats.total_campaigns || 0,
    activeCampaigns: stats.active_campaigns || 0,
    completedCampaigns: stats.completed_campaigns || 0,
    pausedCampaigns: stats.paused_campaigns || 0,
    cancelledCampaigns: stats.cancelled_campaigns || 0,
    totalNumbersCalled: stats.total_numbers_called || 0,
    creditsUsed: Math.round(stats.credits_used || 0)
  };
}

// Get single campaign details
async function getCampaignById(companyId, role, campaignId) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  
  let query = `
    SELECT 
      c.id,
      c.name,
      c.total_numbers,
      c.status,
      c.created_at,
      c.updated_at,
      u.name AS created_by,
      u.email AS created_by_email,
      comp.name AS company_name,
      af.original_name AS audio_file_name,
      af.public_url AS audio_url,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id) AS total_processed,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'completed') AS completed,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('ringing', 'in-progress')) AS active,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('failed', 'busy', 'no-answer')) AS failed,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'queued') AS queued
    FROM campaigns c
    JOIN users u ON u.id = c.created_by
    JOIN companies comp ON comp.id = c.company_id
    LEFT JOIN audio_files af ON af.id = c.audio_file_id
    WHERE c.id = ?
  `;
  
  const params = [campaignId];
  
  if (!isAdmin) {
    query += ` AND c.company_id = ?`;
    params.push(companyId);
  }

  const [campaigns] = await db.query(query, params);

  if (campaigns.length === 0) {
    const error = new Error('Campaign not found');
    error.statusCode = 404;
    throw error;
  }

  const [numbers] = await db.query(
    `SELECT 
      id,
      phone_number,
      status,
      duration_seconds AS duration,
      DATE_FORMAT(updated_at, '%d %b %Y %h:%i %p') AS updated_at
     FROM campaign_numbers
     WHERE campaign_id = ?
     ORDER BY id ASC`,
    [campaignId]
  );

  return {
    ...campaigns[0],
    numbers: numbers || []
  };
}

// Update campaign status
async function updateCampaignStatus(companyId, role, campaignId, status) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  
  const validStatuses = ['processing', 'completed', 'paused', 'cancelled'];
  if (!validStatuses.includes(status)) {
    const error = new Error('Invalid status');
    error.statusCode = 400;
    throw error;
  }

  let query = `SELECT id, status FROM campaigns WHERE id = ?`;
  const params = [campaignId];
  
  if (!isAdmin) {
    query += ` AND company_id = ?`;
    params.push(companyId);
  }

  const [campaign] = await db.query(query, params);

  if (campaign.length === 0) {
    const error = new Error('Campaign not found');
    error.statusCode = 404;
    throw error;
  }

  await db.query(
    `UPDATE campaigns SET status = ?, updated_at = NOW() WHERE id = ?`,
    [status, campaignId]
  );

  return { id: campaignId, status };
}

// Delete campaign
async function deleteCampaign(companyId, role, campaignId) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  
  let query = `SELECT id, status FROM campaigns WHERE id = ?`;
  const params = [campaignId];
  
  if (!isAdmin) {
    query += ` AND company_id = ?`;
    params.push(companyId);
  }

  const [campaign] = await db.query(query, params);

  if (campaign.length === 0) {
    const error = new Error('Campaign not found');
    error.statusCode = 404;
    throw error;
  }

  await db.query(`DELETE FROM campaign_numbers WHERE campaign_id = ?`, [campaignId]);
  await db.query(`DELETE FROM campaigns WHERE id = ?`, [campaignId]);

  return { id: campaignId, deleted: true };
}

module.exports = {
  launchBulkCampaign,
  getLiveCallLogs,
  getAllCampaigns,
  getCampaignById,
  updateCampaignStatus,
  deleteCampaign,
  getCampaignStats,
  dispatchThirdPartyCalls
};