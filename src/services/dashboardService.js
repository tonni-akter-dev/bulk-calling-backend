const db = require('../config/db');

async function getDashboardMetrics(companyId) {
  // 1. Voice Call Stats (Total Sent, Success, Processing, Failed)
  const [[callStats]] = await db.query(
    `SELECT 
      COUNT(*) AS totalVoiceCallSent,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS totalSuccessVoiceCall,
      SUM(CASE WHEN status IN ('queued', 'calling', 'in-progress') THEN 1 ELSE 0 END) AS totalProcessingVoiceCall,
      SUM(CASE WHEN status IN ('failed', 'busy', 'no-answer', 'canceled') THEN 1 ELSE 0 END) AS totalFailedVoiceCall
     FROM campaign_numbers cn
     JOIN campaigns c ON cn.campaign_id = c.id
     WHERE c.company_id = ?`,
    [companyId]
  );

  // 2. Today's Voice Call Stats
  const [[todayStats]] = await db.query(
    `SELECT 
      SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) AS activeCallsLive,
      SUM(CASE WHEN status = 'completed' AND DATE(cn.updated_at) = CURDATE() THEN 1 ELSE 0 END) AS successVoiceCallsToday,
      SUM(CASE WHEN status IN ('failed', 'busy', 'no-answer', 'canceled') AND DATE(cn.updated_at) = CURDATE() THEN 1 ELSE 0 END) AS failedVoiceCallsToday,
      SUM(CASE WHEN DATE(cn.updated_at) = CURDATE() THEN 1 ELSE 0 END) AS totalToday
     FROM campaign_numbers cn
     JOIN campaigns c ON cn.campaign_id = c.id
     WHERE c.company_id = ?`,
    [companyId]
  );

  const totalCallsToday = todayStats.totalToday || 0;
  const successCallsToday = todayStats.successVoiceCallsToday || 0;
  const successRateToday = totalCallsToday > 0 
    ? `${((successCallsToday / totalCallsToday) * 100).toFixed(0)}%` 
    : '0%';

  // 3. Contacts & Groups Stats
  const [[directoryStats]] = await db.query(
    `SELECT 
      (SELECT COUNT(*) FROM contacts WHERE company_id = ?) AS totalContact,
      (SELECT COUNT(*) FROM contacts WHERE company_id = ? AND status = 'Banned') AS totalBannedContact,
      (SELECT COUNT(DISTINCT group_name) FROM contacts WHERE company_id = ? AND group_name IS NOT NULL) AS totalGroup,
      (SELECT COUNT(DISTINCT group_name) FROM contacts WHERE company_id = ? AND status = 'Banned' AND group_name IS NOT NULL) AS totalBannedGroup`,
    [companyId, companyId, companyId, companyId]
  );

  // 4. Live / Active Calls Table
  const [activeCalls] = await db.query(
    `SELECT 
      cn.campaign_id AS campaignId,
      cn.phone_number AS phoneNumber,
      cn.status,
      cn.duration_seconds AS duration
     FROM campaign_numbers cn
     JOIN campaigns c ON cn.campaign_id = c.id
     WHERE c.company_id = ? AND cn.status = 'in-progress'
     ORDER BY cn.id DESC`,
    [companyId]
  );

  return {
    overview: {
      totalVoiceCallSent: callStats.totalVoiceCallSent || 0,
      totalSuccessVoiceCall: callStats.totalSuccessVoiceCall || 0,
      totalProcessingVoiceCall: callStats.totalProcessingVoiceCall || 0,
      totalFailedVoiceCall: callStats.totalFailedVoiceCall || 0,
    },
    today: {
      activeCallsLive: todayStats.activeCallsLive || 0,
      successVoiceCallsToday: successCallsToday,
      successRateToday,
      failedVoiceCallsToday: todayStats.failedVoiceCallsToday || 0,
    },
    directory: {
      totalContact: directoryStats.totalContact || 0,
      totalBannedContact: directoryStats.totalBannedContact || 0,
      totalGroup: directoryStats.totalGroup || 0,
      totalBannedGroup: directoryStats.totalBannedGroup || 0,
    },
    activeCalls,
  };
}

module.exports = { getDashboardMetrics };