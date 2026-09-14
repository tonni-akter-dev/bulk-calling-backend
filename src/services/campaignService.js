// // // src/services/campaignService.js
// // const db = require('../config/db');
// // const axios = require('axios');
// // const wallet = require('./walletService');
// // const { parseNumbersFromText } = require('../utils/numberParser');

// // // Launch Bulk Campaign
// // async function launchBulkCampaign(companyId, userId, { name, targetNumbers, audioFile }) {
// //   if (!name) throw new Error('Campaign name is required');
// //   if (!targetNumbers) throw new Error('Target phone numbers are required');
// //   if (!audioFile) throw new Error('Voice message audio file is required');

// //   const hasBalance = await wallet.hasEnoughForOneCall(companyId);
// //   if (!hasBalance) {
// //     const err = new Error('Insufficient wallet balance or active subscription required');
// //     err.statusCode = 402;
// //     throw err;
// //   }

// //   const numbersArray = parseNumbersFromText(targetNumbers);
// //   if (!numbersArray.length) throw new Error('No valid target phone numbers found');

// //   const publicAudioUrl = `${process.env.BASE_URL}/uploads/audio/${audioFile.filename}`;

// //   // Insert audio file
// //   const [audioResult] = await db.query(
// //     `INSERT INTO audio_files (company_id, original_name, stored_path, public_url) VALUES (?, ?, ?, ?)`,
// //     [companyId, audioFile.originalname, audioFile.path, publicAudioUrl]
// //   );

// //   // Insert campaign - আপনার টেবিলের কলাম অনুযায়ী
// //   const [campaignResult] = await db.query(
// //     `INSERT INTO campaigns (company_id, created_by, title, audio_file_id, total_numbers, status, created_at) 
// //      VALUES (?, ?, ?, ?, ?, 'processing', NOW())`,
// //     [companyId, userId, name, audioResult.insertId, numbersArray.length]
// //   );
// //   const campaignId = campaignResult.insertId;

// //   // Insert campaign numbers
// //   const numberValues = numbersArray.map((num) => [campaignId, num, 'queued']);
// //   await db.query(
// //     `INSERT INTO campaign_numbers (campaign_id, phone_number, status, created_at) VALUES ?`,
// //     [numberValues]
// //   );

// //   // Dispatch calls
// //   dispatchThirdPartyCalls(campaignId, companyId, numbersArray, publicAudioUrl).catch((err) =>
// //     console.error(`Third party dispatch error for campaign ${campaignId}:`, err)
// //   );

// //   return { campaignId, totalNumbers: numbersArray.length, status: 'processing' };
// // }

// // // Dispatch calls to third-party
// // async function dispatchThirdPartyCalls(campaignId, companyId, numbers, audioUrl) {
// //   for (const phone of numbers) {
// //     try {
// //       const response = await axios.post(`${process.env.THIRD_PARTY_VOICE_API_URL}/call`, {
// //         apiKey: process.env.THIRD_PARTY_API_KEY,
// //         to: phone,
// //         audioUrl: audioUrl,
// //         webhookUrl: `${process.env.BASE_URL}/api/webhooks/voice-status`,
// //       });

// //       await db.query(
// //         `UPDATE campaign_numbers SET status = 'ringing', external_call_id = ? WHERE campaign_id = ? AND phone_number = ?`,
// //         [response.data.callId || null, campaignId, phone]
// //       );
// //     } catch (error) {
// //       await db.query(
// //         `UPDATE campaign_numbers SET status = 'failed' WHERE campaign_id = ? AND phone_number = ?`,
// //         [campaignId, phone]
// //       );
// //     }
// //   }
// // }

// // // Get live call logs
// // async function getLiveCallLogs(companyId, role) {
// //   const isAdmin = role === 'admin' || role === 'super_admin';
  
// //   let query = `
// //     SELECT 
// //       COUNT(*) AS total,
// //       SUM(CASE WHEN cn.status = 'completed' THEN 1 ELSE 0 END) AS success,
// //       SUM(CASE WHEN cn.status IN ('ringing', 'in-progress') THEN 1 ELSE 0 END) AS active,
// //       SUM(CASE WHEN cn.status IN ('failed', 'busy', 'no-answer') THEN 1 ELSE 0 END) AS failed
// //     FROM campaign_numbers cn
// //     JOIN campaigns c ON cn.campaign_id = c.id
// //   `;
  
// //   const params = [];
  
// //   if (!isAdmin) {
// //     query += ` WHERE c.company_id = ?`;
// //     params.push(companyId);
// //   }

// //   const [[metrics]] = await db.query(query, params);

// //   let logsQuery = `
// //     SELECT 
// //       cn.id,
// //       cn.phone_number AS phone,
// //       cn.status,
// //       cn.duration_seconds AS duration,
// //       DATE_FORMAT(COALESCE(cn.updated_at, cn.created_at, NOW()), '%h:%i %p') AS time
// //     FROM campaign_numbers cn
// //     JOIN campaigns c ON cn.campaign_id = c.id
// //   `;
  
// //   if (!isAdmin) {
// //     logsQuery += ` WHERE c.company_id = ?`;
// //   }
  
// //   logsQuery += ` ORDER BY COALESCE(cn.updated_at, cn.created_at) DESC LIMIT 50`;

// //   const [logs] = await db.query(logsQuery, params);

// //   return {
// //     summary: {
// //       total: metrics.total || 0,
// //       success: metrics.success || 0,
// //       active: metrics.active || 0,
// //       failed: metrics.failed || 0,
// //     },
// //     logs: logs || [],
// //   };
// // }

// // // Get all campaigns
// // async function getAllCampaigns(companyId, role) {
// //   const isAdmin = role === 'admin' || role === 'super_admin';
  
// //   let query = `
// //     SELECT 
// //       c.id,
// //       c.title AS name,
// //       c.total_numbers,
// //       c.status,
// //       c.created_at,
// //       u.username AS created_by,
// //       u.email AS created_by_email,
// //       c.company_id,
// //       comp.name AS company_name,
// //       af.original_name AS audio_file_name,
// //       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'completed') AS completed,
// //       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('ringing', 'in-progress')) AS active,
// //       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('failed', 'busy', 'no-answer')) AS failed,
// //       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'queued') AS queued,
// //       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id) AS total_processed,
// //       c.total_numbers - (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id) AS remaining
// //     FROM campaigns c
// //     LEFT JOIN users u ON u.id = c.created_by
// //     LEFT JOIN companies comp ON comp.id = c.company_id
// //     LEFT JOIN audio_files af ON af.id = c.audio_file_id
// //   `;
  
// //   const params = [];
  
// //   if (!isAdmin) {
// //     query += ` WHERE c.company_id = ?`;
// //     params.push(companyId);
// //   }
  
// //   query += ` ORDER BY c.created_at DESC`;

// //   const [campaigns] = await db.query(query, params);
// //   return campaigns;
// // }

// // // Get campaign stats
// // async function getCampaignStats(companyId, role) {
// //   const isAdmin = role === 'admin' || role === 'super_admin';
  
// //   let query = `
// //     SELECT 
// //       COUNT(*) AS total_campaigns,
// //       SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS active_campaigns,
// //       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_campaigns,
// //       SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused_campaigns,
// //       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_campaigns,
// //       COALESCE(SUM(total_numbers), 0) AS total_numbers_called,
// //       COALESCE(SUM(total_numbers), 0) * 0.4 AS credits_used
// //     FROM campaigns
// //   `;
  
// //   const params = [];
  
// //   if (!isAdmin) {
// //     query += ` WHERE company_id = ?`;
// //     params.push(companyId);
// //   }

// //   const [[stats]] = await db.query(query, params);

// //   return {
// //     totalCampaigns: stats.total_campaigns || 0,
// //     activeCampaigns: stats.active_campaigns || 0,
// //     completedCampaigns: stats.completed_campaigns || 0,
// //     pausedCampaigns: stats.paused_campaigns || 0,
// //     cancelledCampaigns: stats.cancelled_campaigns || 0,
// //     totalNumbersCalled: stats.total_numbers_called || 0,
// //     creditsUsed: Math.round(stats.credits_used || 0)
// //   };
// // }

// // // Get single campaign details
// // async function getCampaignById(companyId, role, campaignId) {
// //   const isAdmin = role === 'admin' || role === 'super_admin';
  
// //   let query = `
// //     SELECT 
// //       c.id,
// //       c.title AS name,
// //       c.total_numbers,
// //       c.status,
// //       c.created_at,
// //       c.updated_at,
// //       u.username AS created_by,
// //       u.email AS created_by_email,
// //       comp.name AS company_name,
// //       af.original_name AS audio_file_name,
// //       af.public_url AS audio_url,
// //       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id) AS total_processed,
// //       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'completed') AS completed,
// //       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('ringing', 'in-progress')) AS active,
// //       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('failed', 'busy', 'no-answer')) AS failed,
// //       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'queued') AS queued
// //     FROM campaigns c
// //     LEFT JOIN users u ON u.id = c.created_by
// //     LEFT JOIN companies comp ON comp.id = c.company_id
// //     LEFT JOIN audio_files af ON af.id = c.audio_file_id
// //     WHERE c.id = ?
// //   `;
  
// //   const params = [campaignId];
  
// //   if (!isAdmin) {
// //     query += ` AND c.company_id = ?`;
// //     params.push(companyId);
// //   }

// //   const [campaigns] = await db.query(query, params);

// //   if (campaigns.length === 0) {
// //     const error = new Error('Campaign not found');
// //     error.statusCode = 404;
// //     throw error;
// //   }

// //   const [numbers] = await db.query(
// //     `SELECT 
// //       id,
// //       phone_number,
// //       status,
// //       duration_seconds AS duration,
// //       DATE_FORMAT(COALESCE(updated_at, created_at, NOW()), '%d %b %Y %h:%i %p') AS updated_at
// //      FROM campaign_numbers
// //      WHERE campaign_id = ?
// //      ORDER BY id ASC`,
// //     [campaignId]
// //   );

// //   return {
// //     ...campaigns[0],
// //     numbers: numbers || []
// //   };
// // }

// // // Update campaign status
// // async function updateCampaignStatus(companyId, role, campaignId, status) {
// //   const isAdmin = role === 'admin' || role === 'super_admin';
  
// //   const validStatuses = ['processing', 'completed', 'paused', 'cancelled'];
// //   if (!validStatuses.includes(status)) {
// //     const error = new Error('Invalid status');
// //     error.statusCode = 400;
// //     throw error;
// //   }

// //   let query = `SELECT id, status FROM campaigns WHERE id = ?`;
// //   const params = [campaignId];
  
// //   if (!isAdmin) {
// //     query += ` AND company_id = ?`;
// //     params.push(companyId);
// //   }

// //   const [campaign] = await db.query(query, params);

// //   if (campaign.length === 0) {
// //     const error = new Error('Campaign not found');
// //     error.statusCode = 404;
// //     throw error;
// //   }

// //   await db.query(
// //     `UPDATE campaigns SET status = ? WHERE id = ?`,
// //     [status, campaignId]
// //   );

// //   return { id: campaignId, status };
// // }

// // // Delete campaign
// // async function deleteCampaign(companyId, role, campaignId) {
// //   const isAdmin = role === 'admin' || role === 'super_admin';
  
// //   let query = `SELECT id, status FROM campaigns WHERE id = ?`;
// //   const params = [campaignId];
  
// //   if (!isAdmin) {
// //     query += ` AND company_id = ?`;
// //     params.push(companyId);
// //   }

// //   const [campaign] = await db.query(query, params);

// //   if (campaign.length === 0) {
// //     const error = new Error('Campaign not found');
// //     error.statusCode = 404;
// //     throw error;
// //   }

// //   await db.query(`DELETE FROM campaign_numbers WHERE campaign_id = ?`, [campaignId]);
// //   await db.query(`DELETE FROM campaigns WHERE id = ?`, [campaignId]);

// //   return { id: campaignId, deleted: true };
// // }

// // module.exports = {
// //   launchBulkCampaign,
// //   getLiveCallLogs,
// //   getAllCampaigns,
// //   getCampaignById,
// //   updateCampaignStatus,
// //   deleteCampaign,
// //   getCampaignStats,
// //   dispatchThirdPartyCalls
// // };
// // src/services/campaignService.js
// const db = require('../config/db');
// const axios = require('axios');
// const wallet = require('./walletService');
// const { parseNumbersFromText } = require('../utils/numberParser');

// // Launch Bulk Campaign
// async function launchBulkCampaign(companyId, userId, { name, targetNumbers, audioFile }) {
//   if (!name) throw new Error('Campaign name is required');
//   if (!targetNumbers) throw new Error('Target phone numbers are required');
//   if (!audioFile) throw new Error('Voice message audio file is required');

//   const numbersArray = parseNumbersFromText(targetNumbers);
//   if (!numbersArray.length) throw new Error('No valid target phone numbers found');

//   // ===== ENHANCED BALANCE CHECK =====
//   const balance = await wallet.getBalance(companyId);
//   const availableBalance = Number(balance?.wallet_balance_bdt || 0);
//   const ratePerMinute = Number(balance?.rate_per_minute_bdt || 0);
  
//   // Check if enough for all calls (at least 1 minute each)
//   const requiredBalance = ratePerMinute * numbersArray.length;
  
//   if (availableBalance < requiredBalance) {
//     const availableCalls = Math.floor(availableBalance / ratePerMinute);
//     const err = new Error(
//       `Insufficient wallet balance! Available: ${availableBalance.toFixed(2)} TK, ` +
//       `Required: ${requiredBalance.toFixed(2)} TK for ${numbersArray.length} calls, ` +
//       `Available calls: ${availableCalls}`
//     );
//     err.statusCode = 402;
//     err.available = availableBalance;
//     err.required = requiredBalance;
//     err.availableCalls = availableCalls;
//     throw err;
//   }

//   const publicAudioUrl = `${process.env.BASE_URL}/uploads/audio/${audioFile.filename}`;

//   // Insert audio file
//   const [audioResult] = await db.query(
//     `INSERT INTO audio_files (company_id, original_name, stored_path, public_url) VALUES (?, ?, ?, ?)`,
//     [companyId, audioFile.originalname, audioFile.path, publicAudioUrl]
//   );

//   // Insert campaign
//   const [campaignResult] = await db.query(
//     `INSERT INTO campaigns (company_id, created_by, title, audio_file_id, total_numbers, status, created_at) 
//      VALUES (?, ?, ?, ?, ?, 'processing', NOW())`,
//     [companyId, userId, name, audioResult.insertId, numbersArray.length]
//   );
//   const campaignId = campaignResult.insertId;

//   // Insert campaign numbers
//   const numberValues = numbersArray.map((num) => [campaignId, num, 'queued']);
//   await db.query(
//     `INSERT INTO campaign_numbers (campaign_id, phone_number, status, created_at) VALUES ?`,
//     [numberValues]
//   );

//   // Dispatch calls
//   dispatchThirdPartyCalls(campaignId, companyId, numbersArray, publicAudioUrl).catch((err) =>
//     console.error(`Third party dispatch error for campaign ${campaignId}:`, err)
//   );

//   return { 
//     campaignId, 
//     totalNumbers: numbersArray.length, 
//     status: 'processing',
//     availableBalance,
//     requiredBalance,
//     ratePerMinute
//   };
// }

// // Dispatch calls to third-party
// async function dispatchThirdPartyCalls(campaignId, companyId, numbers, audioUrl) {
//   for (const phone of numbers) {
//     try {
//       const response = await axios.post(`${process.env.THIRD_PARTY_VOICE_API_URL}/call`, {
//         apiKey: process.env.THIRD_PARTY_API_KEY,
//         to: phone,
//         audioUrl: audioUrl,
//         webhookUrl: `${process.env.BASE_URL}/api/webhooks/voice-status`,
//       });

//       await db.query(
//         `UPDATE campaign_numbers SET status = 'ringing', external_call_id = ? WHERE campaign_id = ? AND phone_number = ?`,
//         [response.data.callId || null, campaignId, phone]
//       );
//     } catch (error) {
//       await db.query(
//         `UPDATE campaign_numbers SET status = 'failed' WHERE campaign_id = ? AND phone_number = ?`,
//         [campaignId, phone]
//       );
//     }
//   }
// }

// // Get live call logs
// async function getLiveCallLogs(companyId, role) {
//   const isAdmin = role === 'admin' || role === 'super_admin';
  
//   let query = `
//     SELECT 
//       COUNT(*) AS total,
//       SUM(CASE WHEN cn.status = 'completed' THEN 1 ELSE 0 END) AS success,
//       SUM(CASE WHEN cn.status IN ('ringing', 'in-progress') THEN 1 ELSE 0 END) AS active,
//       SUM(CASE WHEN cn.status IN ('failed', 'busy', 'no-answer') THEN 1 ELSE 0 END) AS failed
//     FROM campaign_numbers cn
//     JOIN campaigns c ON cn.campaign_id = c.id
//   `;
  
//   const params = [];
  
//   if (!isAdmin) {
//     query += ` WHERE c.company_id = ?`;
//     params.push(companyId);
//   }

//   const [[metrics]] = await db.query(query, params);

//   let logsQuery = `
//     SELECT 
//       cn.id,
//       cn.phone_number AS phone,
//       cn.status,
//       cn.duration_seconds AS duration,
//       DATE_FORMAT(COALESCE(cn.updated_at, cn.created_at, NOW()), '%h:%i %p') AS time
//     FROM campaign_numbers cn
//     JOIN campaigns c ON cn.campaign_id = c.id
//   `;
  
//   if (!isAdmin) {
//     logsQuery += ` WHERE c.company_id = ?`;
//   }
  
//   logsQuery += ` ORDER BY COALESCE(cn.updated_at, cn.created_at) DESC LIMIT 50`;

//   const [logs] = await db.query(logsQuery, params);

//   return {
//     summary: {
//       total: metrics.total || 0,
//       success: metrics.success || 0,
//       active: metrics.active || 0,
//       failed: metrics.failed || 0,
//     },
//     logs: logs || [],
//   };
// }

// // Get all campaigns
// async function getAllCampaigns(companyId, role) {
//   const isAdmin = role === 'admin' || role === 'super_admin';
  
//   let query = `
//     SELECT 
//       c.id,
//       c.title AS name,
//       c.total_numbers,
//       c.status,
//       c.created_at,
//       u.username AS created_by,
//       u.email AS created_by_email,
//       c.company_id,
//       comp.name AS company_name,
//       af.original_name AS audio_file_name,
//       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'completed') AS completed,
//       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('ringing', 'in-progress')) AS active,
//       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('failed', 'busy', 'no-answer')) AS failed,
//       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'queued') AS queued,
//       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id) AS total_processed,
//       c.total_numbers - (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id) AS remaining
//     FROM campaigns c
//     LEFT JOIN users u ON u.id = c.created_by
//     LEFT JOIN companies comp ON comp.id = c.company_id
//     LEFT JOIN audio_files af ON af.id = c.audio_file_id
//   `;
  
//   const params = [];
  
//   if (!isAdmin) {
//     query += ` WHERE c.company_id = ?`;
//     params.push(companyId);
//   }
  
//   query += ` ORDER BY c.created_at DESC`;

//   const [campaigns] = await db.query(query, params);
//   return campaigns;
// }

// // Get campaign stats
// async function getCampaignStats(companyId, role) {
//   const isAdmin = role === 'admin' || role === 'super_admin';
  
//   let query = `
//     SELECT 
//       COUNT(*) AS total_campaigns,
//       SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS active_campaigns,
//       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_campaigns,
//       SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused_campaigns,
//       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_campaigns,
//       COALESCE(SUM(total_numbers), 0) AS total_numbers_called,
//       COALESCE(SUM(total_numbers), 0) * 0.4 AS credits_used
//     FROM campaigns
//   `;
  
//   const params = [];
  
//   if (!isAdmin) {
//     query += ` WHERE company_id = ?`;
//     params.push(companyId);
//   }

//   const [[stats]] = await db.query(query, params);

//   return {
//     totalCampaigns: stats.total_campaigns || 0,
//     activeCampaigns: stats.active_campaigns || 0,
//     completedCampaigns: stats.completed_campaigns || 0,
//     pausedCampaigns: stats.paused_campaigns || 0,
//     cancelledCampaigns: stats.cancelled_campaigns || 0,
//     totalNumbersCalled: stats.total_numbers_called || 0,
//     creditsUsed: Math.round(stats.credits_used || 0)
//   };
// }

// // Get single campaign details
// async function getCampaignById(companyId, role, campaignId) {
//   const isAdmin = role === 'admin' || role === 'super_admin';
  
//   let query = `
//     SELECT 
//       c.id,
//       c.title AS name,
//       c.total_numbers,
//       c.status,
//       c.created_at,
//       c.updated_at,
//       u.username AS created_by,
//       u.email AS created_by_email,
//       comp.name AS company_name,
//       af.original_name AS audio_file_name,
//       af.public_url AS audio_url,
//       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id) AS total_processed,
//       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'completed') AS completed,
//       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('ringing', 'in-progress')) AS active,
//       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('failed', 'busy', 'no-answer')) AS failed,
//       (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'queued') AS queued
//     FROM campaigns c
//     LEFT JOIN users u ON u.id = c.created_by
//     LEFT JOIN companies comp ON comp.id = c.company_id
//     LEFT JOIN audio_files af ON af.id = c.audio_file_id
//     WHERE c.id = ?
//   `;
  
//   const params = [campaignId];
  
//   if (!isAdmin) {
//     query += ` AND c.company_id = ?`;
//     params.push(companyId);
//   }

//   const [campaigns] = await db.query(query, params);

//   if (campaigns.length === 0) {
//     const error = new Error('Campaign not found');
//     error.statusCode = 404;
//     throw error;
//   }

//   const [numbers] = await db.query(
//     `SELECT 
//       id,
//       phone_number,
//       status,
//       duration_seconds AS duration,
//       DATE_FORMAT(COALESCE(updated_at, created_at, NOW()), '%d %b %Y %h:%i %p') AS updated_at
//      FROM campaign_numbers
//      WHERE campaign_id = ?
//      ORDER BY id ASC`,
//     [campaignId]
//   );

//   return {
//     ...campaigns[0],
//     numbers: numbers || []
//   };
// }

// // Update campaign status
// async function updateCampaignStatus(companyId, role, campaignId, status) {
//   const isAdmin = role === 'admin' || role === 'super_admin';
  
//   const validStatuses = ['processing', 'completed', 'paused', 'cancelled'];
//   if (!validStatuses.includes(status)) {
//     const error = new Error('Invalid status');
//     error.statusCode = 400;
//     throw error;
//   }

//   let query = `SELECT id, status FROM campaigns WHERE id = ?`;
//   const params = [campaignId];
  
//   if (!isAdmin) {
//     query += ` AND company_id = ?`;
//     params.push(companyId);
//   }

//   const [campaign] = await db.query(query, params);

//   if (campaign.length === 0) {
//     const error = new Error('Campaign not found');
//     error.statusCode = 404;
//     throw error;
//   }

//   await db.query(
//     `UPDATE campaigns SET status = ? WHERE id = ?`,
//     [status, campaignId]
//   );

//   return { id: campaignId, status };
// }

// // Delete campaign
// async function deleteCampaign(companyId, role, campaignId) {
//   const isAdmin = role === 'admin' || role === 'super_admin';
  
//   let query = `SELECT id, status FROM campaigns WHERE id = ?`;
//   const params = [campaignId];
  
//   if (!isAdmin) {
//     query += ` AND company_id = ?`;
//     params.push(companyId);
//   }

//   const [campaign] = await db.query(query, params);

//   if (campaign.length === 0) {
//     const error = new Error('Campaign not found');
//     error.statusCode = 404;
//     throw error;
//   }

//   await db.query(`DELETE FROM campaign_numbers WHERE campaign_id = ?`, [campaignId]);
//   await db.query(`DELETE FROM campaigns WHERE id = ?`, [campaignId]);

//   return { id: campaignId, deleted: true };
// }

// module.exports = {
//   launchBulkCampaign,
//   getLiveCallLogs,
//   getAllCampaigns,
//   getCampaignById,
//   updateCampaignStatus,
//   deleteCampaign,
//   getCampaignStats,
//   dispatchThirdPartyCalls
// };
// src/services/campaignService.js
const db = require('../config/db');
const axios = require('axios');
const wallet = require('./walletService');
const { parseNumbersFromText } = require('../utils/numberParser');

const IPCALL_BASE = process.env.IPCALL_BASE_URL || 'https://ipcall.bd/voiceapi';

// ============================================================
// IP Call BD — Voice Upload (register audio → campaign_id)
// ============================================================
async function registerVoiceWithIpcall({ voice_name, audio_url }) {
  const apiKey = process.env.IPCALL_API_KEY;
  if (!apiKey) throw new Error('IPCALL_API_KEY not configured');

  const url = new URL(`${IPCALL_BASE}/uploadvoice/`);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('voice_name', voice_name);
  url.searchParams.set('audio_url', audio_url);

  const { data } = await axios.get(url.toString(), { timeout: 30000 });

  if (!data || data.status !== 'success' || !data.campaign_id) {
    throw new Error(data?.message || 'IP Call BD voice upload failed');
  }

  return {
    campaignId: data.campaign_id,
    name: data.Name || voice_name,
  };
}

// ============================================================
// IP Call BD — Single Voice Call
// ============================================================
async function sendIpcallRequest({
  number,
  campaignName,
  webhookUrl,
  trackingData,
}) {
  const apiKey = process.env.IPCALL_API_KEY;
  if (!apiKey) throw new Error('IPCALL_API_KEY not configured');

  const url = new URL(`${IPCALL_BASE}/newrequest/`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('number', number);
  url.searchParams.set('campaign_name', campaignName);
  if (webhookUrl) url.searchParams.set('webhook', webhookUrl);
  if (trackingData) url.searchParams.set('data', trackingData);

  const { data } = await axios.get(url.toString(), { timeout: 20000 });
  return data;
}

// ============================================================
// Map IP Call BD webhook status → DB status
// ============================================================
function mapIpcallStatusToDb(ipcallStatus, statusCode) {
  const s = String(ipcallStatus || '').toLowerCase().trim();

  // Webhook statuses: "Answered", "Busy", "No Answer", "Failed", "Missed"
  if (s === 'answered') return 'completed';
  if (s === 'busy') return 'busy';
  if (s === 'no answer') return 'no-answer';
  if (s === 'missed') return 'failed';
  if (s === 'failed') return 'failed';

  // Fallback on status_code (as per IP Call BD docs "1" = answered)
  if (statusCode === '1') return 'completed';

  return 'completed';
}

// ============================================================
// Launch Bulk Campaign
// ============================================================
async function launchBulkCampaign(
  companyId,
  userId,
  { name, targetNumbers, audioFile, audioFileId }
) {
  if (!name) throw new Error('Campaign name is required');
  if (!targetNumbers) throw new Error('Target phone numbers are required');

  const numbersArray = parseNumbersFromText(targetNumbers);
  if (!numbersArray.length) throw new Error('No valid target phone numbers found');

  // ===== Balance check =====
  const balance = await wallet.getBalance(companyId);
  const availableBalance = Number(balance?.wallet_balance_bdt || 0);
  const ratePerMinute = Number(balance?.rate_per_minute_bdt || 0);

  const requiredBalance = ratePerMinute * numbersArray.length;

  if (availableBalance < requiredBalance) {
    const availableCalls = Math.floor(availableBalance / ratePerMinute);
    const err = new Error(
      `Insufficient wallet balance! Available: ${availableBalance.toFixed(2)} TK, ` +
        `Required: ${requiredBalance.toFixed(2)} TK for ${numbersArray.length} calls, ` +
        `Available calls: ${availableCalls}`
    );
    err.statusCode = 402;
    err.available = availableBalance;
    err.required = requiredBalance;
    err.availableCalls = availableCalls;
    throw err;
  }

  let ipcallCampaignId;
  let audioFileRowId;
  let publicAudioUrl;

  // ============================================================
  // Case A: Existing voice file (audioFileId provided)
  // ============================================================
  if (audioFileId) {
    const [[existing]] = await db.query(
      `SELECT id, original_name, public_url, campaign_id
       FROM audio_files
       WHERE id = ? AND company_id = ?`,
      [audioFileId, companyId]
    );

    if (!existing) {
      const e = new Error('Selected voice file not found');
      e.statusCode = 404;
      throw e;
    }

    audioFileRowId = existing.id;
    publicAudioUrl = existing.public_url;
    ipcallCampaignId = existing.campaign_id;

    // If not yet registered with IP Call BD (legacy file), register now
    if (!ipcallCampaignId) {
      const reg = await registerVoiceWithIpcall({
        voice_name: existing.original_name,
        audio_url: existing.public_url,
      });
      ipcallCampaignId = reg.campaignId;
      await db.query(
        `UPDATE audio_files SET campaign_id = ? WHERE id = ?`,
        [ipcallCampaignId, existing.id]
      );
    }
  }
  // ============================================================
  // Case B: New file upload (audioFile provided)
  // ============================================================
  else if (audioFile) {
    publicAudioUrl = `${process.env.BASE_URL}/uploads/audio/${audioFile.filename}`;

    // 1) Register with IP Call BD first
    const reg = await registerVoiceWithIpcall({
      voice_name: name,
      audio_url: publicAudioUrl,
    });
    ipcallCampaignId = reg.campaignId;

    // 2) Save to DB with campaign_id
    const [audioResult] = await db.query(
      `INSERT INTO audio_files
         (company_id, original_name, stored_path, public_url, format, campaign_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        audioFile.originalname,
        audioFile.path,
        publicAudioUrl,
        (audioFile.originalname.split('.').pop() || 'mp3').toLowerCase(),
        ipcallCampaignId,
      ]
    );
    audioFileRowId = audioResult.insertId;
  } else {
    throw new Error('Voice message audio file is required');
  }

  // ============================================================
  // Insert campaign
  // ============================================================
  const [campaignResult] = await db.query(
    `INSERT INTO campaigns
       (company_id, created_by, title, audio_file_id, total_numbers, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'processing', NOW())`,
    [companyId, userId, name, audioFileRowId, numbersArray.length]
  );
  const campaignId = campaignResult.insertId;

  // ============================================================
  // Insert campaign_numbers (queued)
  // ============================================================
  const numberValues = numbersArray.map((num) => [
    campaignId,
    num,
    'queued',
  ]);
  await db.query(
    `INSERT INTO campaign_numbers (campaign_id, phone_number, status, created_at)
     VALUES ?`,
    [numberValues]
  );

  // ============================================================
  // Dispatch to IP Call BD (async — no await, background)
  // ============================================================
  dispatchIpcallRequests({
    campaignId,
    companyId,
    numbers: numbersArray,
    ipcallCampaignId,
  }).catch((err) =>
    console.error(`[campaign ${campaignId}] dispatch error:`, err.message)
  );

  return {
    campaignId,
    totalNumbers: numbersArray.length,
    status: 'processing',
    ipcallCampaignId,
    availableBalance,
    requiredBalance,
    ratePerMinute,
  };
}

// ============================================================
// Dispatch all numbers to IP Call BD /newrequest/
// ============================================================

async function dispatchIpcallRequests({ campaignId, numbers, ipcallCampaignId }) {
  const [rows] = await db.query(
    `SELECT id, phone_number FROM campaign_numbers WHERE campaign_id = ?`,
    [campaignId]
  );
  const phoneToRowId = new Map(rows.map((r) => [r.phone_number, r.id]));

  const webhookUrl = `${process.env.BASE_URL}/api/webhooks/voice-status`;
  const apiKey = process.env.IPCALL_API_KEY;

  for (const phone of numbers) {
    const rowId = phoneToRowId.get(phone);
    if (!rowId) continue;

    try {
      const url = new URL("https://ipcall.bd/voiceapi/newrequest/");
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("number", phone);
      url.searchParams.set("campaign_name", ipcallCampaignId);
      url.searchParams.set("webhook", webhookUrl);
      url.searchParams.set("data", `camp_${campaignId}_num_${rowId}`);

      const { data } = await axios.get(url.toString());

      if (data.status === "success") {
        await db.query(
          `UPDATE campaign_numbers SET status = 'ringing', updated_at = NOW() WHERE id = ?`,
          [rowId]
        );
      } else {
        await db.query(
          `UPDATE campaign_numbers SET status = 'failed', updated_at = NOW() WHERE id = ?`,
          [rowId]
        );
      }
    } catch (e) {
      await db.query(
        `UPDATE campaign_numbers SET status = 'failed', updated_at = NOW() WHERE id = ?`,
        [rowId]
      );
    }
  }
}

// ============================================================
// Webhook handler — called by IP Call BD on status update
// ============================================================
async function handleVoiceWebhook(payload) {
  const { id, status_code, status, DTMF, data } = payload || {};

  // Parse tracking data: "camp_123_num_456"
  const match = /^camp_(\d+)_num_(\d+)$/.exec(String(data || ''));
  if (!match) {
    console.warn('[webhook] invalid tracking data:', data);
    return { handled: false, reason: 'invalid_data' };
  }

  const campaignId = Number(match[1]);
  const numberRowId = Number(match[2]);

  const dbStatus = mapIpcallStatusToDb(status, status_code);

  await db.query(
    `UPDATE campaign_numbers
       SET status = ?,
           external_call_id = COALESCE(?, external_call_id),
           dtmf = ?,
           updated_at = NOW()
     WHERE id = ? AND campaign_id = ?`,
    [dbStatus, id || null, DTMF || null, numberRowId, campaignId]
  );

  // If all numbers terminal → mark campaign completed
  try {
    const [[summary]] = await db.query(
      `SELECT
         SUM(CASE WHEN status IN ('queued','ringing','in-progress') THEN 1 ELSE 0 END) AS pending
       FROM campaign_numbers WHERE campaign_id = ?`,
      [campaignId]
    );
    if ((summary?.pending || 0) === 0) {
      await db.query(
        `UPDATE campaigns SET status = 'completed', updated_at = NOW() WHERE id = ?`,
        [campaignId]
      );
    }
  } catch (e) {
    console.warn('campaign completion check failed:', e.message);
  }

  return { handled: true, status: dbStatus };
}

// ============================================================
// Get live call logs (unchanged query, still valid)
// ============================================================
async function getLiveCallLogs(companyId, role) {
  const isAdmin = role === 'admin' || role === 'super_admin';

  let query = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN cn.status = 'completed' THEN 1 ELSE 0 END) AS success,
      SUM(CASE WHEN cn.status IN ('ringing','in-progress') THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN cn.status IN ('failed','busy','no-answer') THEN 1 ELSE 0 END) AS failed
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
      DATE_FORMAT(COALESCE(cn.updated_at, cn.created_at, NOW()), '%h:%i %p') AS time
    FROM campaign_numbers cn
    JOIN campaigns c ON cn.campaign_id = c.id
  `;
  if (!isAdmin) logsQuery += ` WHERE c.company_id = ?`;
  logsQuery += ` ORDER BY COALESCE(cn.updated_at, cn.created_at) DESC LIMIT 50`;

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

// ============================================================
// Other existing functions (unchanged)
// ============================================================
async function getAllCampaigns(companyId, role) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  let query = `
    SELECT
      c.id, c.title AS name, c.total_numbers, c.status, c.created_at,
      u.username AS created_by, u.email AS created_by_email,
      c.company_id, comp.name AS company_name,
      af.original_name AS audio_file_name,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'completed') AS completed,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('ringing','in-progress')) AS active,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('failed','busy','no-answer')) AS failed,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'queued') AS queued,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id) AS total_processed,
      c.total_numbers - (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id) AS remaining
    FROM campaigns c
    LEFT JOIN users u ON u.id = c.created_by
    LEFT JOIN companies comp ON comp.id = c.company_id
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

async function getCampaignStats(companyId, role) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  let query = `
    SELECT
      COUNT(*) AS total_campaigns,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS active_campaigns,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_campaigns,
      SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused_campaigns,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_campaigns,
      COALESCE(SUM(total_numbers), 0) AS total_numbers_called,
      COALESCE(SUM(total_numbers), 0) * 0.4 AS credits_used
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
    creditsUsed: Math.round(stats.credits_used || 0),
  };
}

async function getCampaignById(companyId, role, campaignId) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  let query = `
    SELECT
      c.id, c.title AS name, c.total_numbers, c.status,
      c.created_at, c.updated_at,
      u.username AS created_by, u.email AS created_by_email,
      comp.name AS company_name,
      af.original_name AS audio_file_name, af.public_url AS audio_url,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id) AS total_processed,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'completed') AS completed,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('ringing','in-progress')) AS active,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status IN ('failed','busy','no-answer')) AS failed,
      (SELECT COUNT(*) FROM campaign_numbers WHERE campaign_id = c.id AND status = 'queued') AS queued
    FROM campaigns c
    LEFT JOIN users u ON u.id = c.created_by
    LEFT JOIN companies comp ON comp.id = c.company_id
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
    const e = new Error('Campaign not found');
    e.statusCode = 404;
    throw e;
  }
  const [numbers] = await db.query(
    `SELECT id, phone_number, status, duration_seconds AS duration,
       DATE_FORMAT(COALESCE(updated_at, created_at, NOW()), '%d %b %Y %h:%i %p') AS updated_at
     FROM campaign_numbers WHERE campaign_id = ? ORDER BY id ASC`,
    [campaignId]
  );
  return { ...campaigns[0], numbers: numbers || [] };
}

async function updateCampaignStatus(companyId, role, campaignId, status) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  const validStatuses = ['processing', 'completed', 'paused', 'cancelled'];
  if (!validStatuses.includes(status)) {
    const e = new Error('Invalid status');
    e.statusCode = 400;
    throw e;
  }
  let query = `SELECT id FROM campaigns WHERE id = ?`;
  const params = [campaignId];
  if (!isAdmin) {
    query += ` AND company_id = ?`;
    params.push(companyId);
  }
  const [campaign] = await db.query(query, params);
  if (campaign.length === 0) {
    const e = new Error('Campaign not found');
    e.statusCode = 404;
    throw e;
  }
  await db.query(`UPDATE campaigns SET status = ?, updated_at = NOW() WHERE id = ?`, [
    status,
    campaignId,
  ]);
  return { id: campaignId, status };
}

async function deleteCampaign(companyId, role, campaignId) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  let query = `SELECT id FROM campaigns WHERE id = ?`;
  const params = [campaignId];
  if (!isAdmin) {
    query += ` AND company_id = ?`;
    params.push(companyId);
  }
  const [campaign] = await db.query(query, params);
  if (campaign.length === 0) {
    const e = new Error('Campaign not found');
    e.statusCode = 404;
    throw e;
  }
  await db.query(`DELETE FROM campaign_numbers WHERE campaign_id = ?`, [campaignId]);
  await db.query(`DELETE FROM campaigns WHERE id = ?`, [campaignId]);
  return { id: campaignId, deleted: true };
}
// ============================================================
// 🆕 Register voice by URL only (no file upload)
//    - IP Call BD এ register করে campaign_id আনে
//    - audio_files table এ save করে
//    - Return করে audio file row (id দিয়ে campaign launch হবে)
// ============================================================
async function registerVoiceByUrl(companyId, { voice_name, audio_url }) {
  if (!voice_name) throw new Error('voice_name is required');
  if (!audio_url) throw new Error('audio_url is required');

  // ── ১. IP Call BD এ register ──
  const reg = await registerVoiceWithIpcall({ voice_name, audio_url });

  // ── ২. DB এ save ──
  const ext = audio_url.split('?')[0].split('.').pop()?.toLowerCase() || 'mp3';
  const format = ['mp3', 'wav', 'ogg'].includes(ext) ? ext : 'mp3';

  const [result] = await db.query(
    `INSERT INTO audio_files
       (company_id, original_name, public_url, format, campaign_id, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [companyId, voice_name, audio_url, format, reg.campaignId]
  );

  return {
    id: result.insertId,             // ⚠️ এটাই frontend এ audioFileId হবে
    name: voice_name,
    url: audio_url,
    format: format.toUpperCase(),
    campaignId: reg.campaignId,      // IP Call BD এর v14_xxx
  };
}
module.exports = {
  launchBulkCampaign,
  getLiveCallLogs,
  getAllCampaigns,
  getCampaignById,
  updateCampaignStatus,
  deleteCampaign,
  getCampaignStats,
  dispatchIpcallRequests,
  handleVoiceWebhook,
  registerVoiceWithIpcall,
  registerVoiceByUrl
};