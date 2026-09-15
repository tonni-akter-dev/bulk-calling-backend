// src/services/dashboardService.js
const db = require('../config/db');

async function getDashboardMetrics(companyId) {
  // ============================================================
  // 1. Overall Voice Call Stats
  // ============================================================
  const [[callStats]] = await db.query(
    `SELECT
      COUNT(*) AS totalVoiceCallSent,
      SUM(CASE WHEN cn.status = 'completed' THEN 1 ELSE 0 END) AS totalSuccessVoiceCall,
      SUM(CASE WHEN cn.status IN ('queued', 'calling', 'in-progress', 'ringing') THEN 1 ELSE 0 END) AS totalProcessingVoiceCall,
      SUM(CASE WHEN cn.status IN ('failed', 'busy', 'no-answer', 'canceled') THEN 1 ELSE 0 END) AS totalFailedVoiceCall
     FROM campaign_numbers cn
     JOIN campaigns c ON cn.campaign_id = c.id
     WHERE c.company_id = ?`,
    [companyId]
  );

  // ============================================================
  // 2. Today's Stats
  // ============================================================
  const [[todayStats]] = await db.query(
    `SELECT
      SUM(CASE WHEN cn.status = 'in-progress' THEN 1 ELSE 0 END) AS activeCallsLive,
      SUM(CASE WHEN cn.status = 'completed' AND DATE(cn.updated_at) = CURDATE() THEN 1 ELSE 0 END) AS successVoiceCallsToday,
      SUM(CASE WHEN cn.status IN ('failed', 'busy', 'no-answer', 'canceled') AND DATE(cn.updated_at) = CURDATE() THEN 1 ELSE 0 END) AS failedVoiceCallsToday,
      SUM(CASE WHEN DATE(cn.updated_at) = CURDATE() THEN 1 ELSE 0 END) AS totalToday
     FROM campaign_numbers cn
     JOIN campaigns c ON cn.campaign_id = c.id
     WHERE c.company_id = ?`,
    [companyId]
  );

  const totalCallsToday = todayStats.totalToday || 0;
  const successCallsToday = todayStats.successVoiceCallsToday || 0;
  const successRateToday =
    totalCallsToday > 0
      ? `${Math.round((successCallsToday / totalCallsToday) * 100)}%`
      : '0%';

  // ============================================================
  // 3. Contacts & Groups
  // ============================================================
  const [[directoryStats]] = await db.query(
    `SELECT
      (SELECT COUNT(*) FROM contacts WHERE company_id = ?) AS totalContact,
      (SELECT COUNT(*) FROM contacts WHERE company_id = ? AND status = 'Banned') AS totalBannedContact,
      (SELECT COUNT(DISTINCT group_name) FROM contacts WHERE company_id = ? AND group_name IS NOT NULL) AS totalGroup,
      (SELECT COUNT(DISTINCT group_name) FROM contacts WHERE company_id = ? AND status = 'Banned' AND group_name IS NOT NULL) AS totalBannedGroup`,
    [companyId, companyId, companyId, companyId]
  );

  // ============================================================
  // 4. Active Calls (Live table)
  // ============================================================
  const [activeCalls] = await db.query(
    `SELECT
      cn.id AS id,
      cn.campaign_id AS campaignId,
      cn.phone_number AS phoneNumber,
      cn.status,
      cn.duration_seconds AS duration,
      cn.created_at
     FROM campaign_numbers cn
     JOIN campaigns c ON cn.campaign_id = c.id
     WHERE c.company_id = ?
       AND cn.status IN ('in-progress', 'ringing')
     ORDER BY cn.updated_at DESC, cn.id DESC
     LIMIT 50`,
    [companyId]
  );

  return {
    overview: {
      totalVoiceCallSent: Number(callStats.totalVoiceCallSent) || 0,
      totalSuccessVoiceCall: Number(callStats.totalSuccessVoiceCall) || 0,
      totalProcessingVoiceCall: Number(callStats.totalProcessingVoiceCall) || 0,
      totalFailedVoiceCall: Number(callStats.totalFailedVoiceCall) || 0,
    },
    today: {
      activeCallsLive: Number(todayStats.activeCallsLive) || 0,
      successVoiceCallsToday: successCallsToday,
      successRateToday,
      failedVoiceCallsToday: Number(todayStats.failedVoiceCallsToday) || 0,
    },
    directory: {
      totalContact: Number(directoryStats.totalContact) || 0,
      totalBannedContact: Number(directoryStats.totalBannedContact) || 0,
      totalGroup: Number(directoryStats.totalGroup) || 0,
      totalBannedGroup: Number(directoryStats.totalBannedGroup) || 0,
    },
    activeCalls,
  };
}

module.exports = { getDashboardMetrics };