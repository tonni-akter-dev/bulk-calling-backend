const db = require('../config/db');
const axios = require('axios'); // or your chosen 3rd-party provider SDK
const wallet = require('./walletService');
const { parseNumbersFromText } = require('../utils/numberParser');

async function launchBulkCampaign(companyId, userId, { name, targetNumbers, audioFile }) {
  if (!name) throw new Error('Campaign name is required');
  if (!targetNumbers) throw new Error('Target phone numbers are required');
  if (!audioFile) throw new Error('Voice message audio file is required');

  // Check subscription / wallet balance
  const hasBalance = await wallet.hasEnoughForOneCall(companyId);
  if (!hasBalance) {
    const err = new Error('Insufficient wallet balance or active subscription required');
    err.statusCode = 402;
    throw err;
  }

  // Parse target numbers
  const numbersArray = parseNumbersFromText(targetNumbers);
  if (!numbersArray.length) throw new Error('No valid target phone numbers found');

  const publicAudioUrl = `${process.env.BASE_URL}/uploads/audio/${audioFile.filename}`;

  // 1. Create Audio Record
  const [audioResult] = await db.query(
    `INSERT INTO audio_files (company_id, original_name, stored_path, public_url) VALUES (?, ?, ?, ?)`,
    [companyId, audioFile.originalname, audioFile.path, publicAudioUrl]
  );

  // 2. Create Campaign Record
  const [campaignResult] = await db.query(
    `INSERT INTO campaigns (company_id, created_by, name, audio_file_id, total_numbers, status) VALUES (?, ?, ?, ?, ?, 'processing')`,
    [companyId, userId, name, audioResult.insertId, numbersArray.length]
  );
  const campaignId = campaignResult.insertId;

  // 3. Insert Campaign Numbers
  const numberValues = numbersArray.map((num) => [campaignId, num, 'queued']);
  await db.query(`INSERT INTO campaign_numbers (campaign_id, phone_number, status) VALUES ?`, [numberValues]);

  // 4. Trigger Third-Party API Async Call Dispatch
  dispatchThirdPartyCalls(campaignId, companyId, numbersArray, publicAudioUrl).catch((err) =>
    console.error(`Third party dispatch error for campaign ${campaignId}:`, err)
  );

  return { campaignId, totalNumbers: numbersArray.length, status: 'processing' };
}

async function dispatchThirdPartyCalls(campaignId, companyId, numbers, audioUrl) {
  for (const phone of numbers) {
    try {
      // Call 3rd-Party Telephony API
      const response = await axios.post(`${process.env.THIRD_PARTY_VOICE_API_URL}/call`, {
        apiKey: process.env.THIRD_PARTY_API_KEY,
        to: phone,
        audioUrl: audioUrl,
        webhookUrl: `${process.env.BASE_URL}/api/webhooks/voice-status`,
      });

      // Update call status to ringing / in-progress
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

async function getLiveCallLogs(companyId) {
  // Aggregate Metrics
  const [[metrics]] = await db.query(
    `SELECT 
      SUM(CASE WHEN cn.status = 'completed' THEN 1 ELSE 0 END) AS success,
      SUM(CASE WHEN cn.status IN ('ringing', 'in-progress') THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN cn.status IN ('failed', 'busy', 'no-answer') THEN 1 ELSE 0 END) AS failed
     FROM campaign_numbers cn
     JOIN campaigns c ON cn.campaign_id = c.id
     WHERE c.company_id = ?`,
    [companyId]
  );

  // Live Call Activity List
  const [logs] = await db.query(
    `SELECT 
      cn.id,
      cn.phone_number AS phoneNumber,
      cn.status,
      cn.duration_seconds AS duration,
      cn.updated_at AS time
     FROM campaign_numbers cn
     JOIN campaigns c ON cn.campaign_id = c.id
     WHERE c.company_id = ?
     ORDER BY cn.updated_at DESC LIMIT 20`,
    [companyId]
  );

  return {
    summary: {
      success: metrics.success || 0,
      active: metrics.active || 0,
      failed: metrics.failed || 0,
    },
    logs,
  };
}

module.exports = { launchBulkCampaign, getLiveCallLogs };