// src/services/ipcallSyncService.js
const axios = require('axios');
const db = require('../config/db');
const settingsService = require('./settingsService');

const IPCALL_BASE = process.env.IPCALL_BASE_URL || 'https://ipcall.bd/voiceapi';

// ============================================================
// Helper: Get API key from DB
// ============================================================
async function getApiKey() {
  const apiKey = await settingsService.getIpcallApiKey();
  if (!apiKey) throw new Error('IPCall API key not configured');
  return apiKey;
}

// ============================================================
// Status mapper — robust
// ============================================================
function mapIpcallStatusToDb(ipcallStatus) {
  const s = String(ipcallStatus || '').toLowerCase().trim();
  if (s === 'answered' || s === 'answer') return 'completed';
  if (s === 'busy') return 'busy';
  if (s === 'no answer' || s === 'no-answer' || s === 'noanswer') return 'no-answer';
  if (s === 'missed') return 'failed';
  if (s === 'failed') return 'failed';
  if (s === 'ringing') return 'ringing';
  if (s === 'in-progress' || s === 'in progress') return 'in-progress';
  return 'completed';
}

// ============================================================
// Fetch IPCall /calllogs/
// ============================================================
async function fetchCallLogs({ date_from, date_to, page = 1, per_page = 200 } = {}) {
  const apiKey = await getApiKey();

  const url = new URL(`${IPCALL_BASE}/calllogs/`);
  url.searchParams.set('apikey', apiKey);
  if (date_from) url.searchParams.set('date_from', date_from);
  if (date_to) url.searchParams.set('date_to', date_to);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(per_page));

  const { data } = await axios.get(url.toString(), { timeout: 30000 });
  return data;
}

// ============================================================
// ✅ FIXED: Sync pending calls by phone number
// ============================================================
async function syncRecentCalls() {
  try {
    // ✅ FIX: Find pending calls (NOT external_call_id dependent)
    const [rows] = await db.query(
      `SELECT id, phone_number, campaign_id, status, created_at
         FROM campaign_numbers
        WHERE status IN ('queued', 'ringing', 'in-progress')
          AND created_at >= DATE_SUB(NOW(), INTERVAL 2 DAY)
        ORDER BY id DESC
        LIMIT 500`
    );

    if (!rows.length) {
      return { synced: 0, message: 'Nothing to sync' };
    }

    console.log(`[IPCallSync] Checking ${rows.length} pending calls`);

    // Fetch IPCall call logs from last 2 days
    const today = new Date().toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

    const allLogs = [];
    let page = 1;

    while (true) {
      const resp = await fetchCallLogs({
        date_from: twoDaysAgo,
        date_to: today,
        page,
        per_page: 200,
      });

      if (!resp || resp.status !== 'success' || !Array.isArray(resp.data)) break;
      allLogs.push(...resp.data);

      if (page >= (resp.total_pages || 1)) break;
      page += 1;
      if (page > 10) break; // Safety
    }

    if (!allLogs.length) {
      console.log('[IPCallSync] No call logs fetched from IPCall');
      return { fetched: 0, updated: 0 };
    }

    // ✅ Group logs by caller phone number (keep latest)
    const logByPhone = new Map();
    for (const log of allLogs) {
      if (log.caller) {
        const phone = String(log.caller);
        const existing = logByPhone.get(phone);
        // Keep the latest log
        if (!existing || (log.call_time && log.call_time > existing.call_time)) {
          logByPhone.set(phone, log);
        }
      }
    }

    let updated = 0;
    const touchedCampaigns = new Set();

    for (const row of rows) {
      const log = logByPhone.get(String(row.phone_number));
      if (!log) continue;

      const dbStatus = mapIpcallStatusToDb(log.status);

      const [result] = await db.query(
        `UPDATE campaign_numbers
            SET status = ?,
                duration_seconds = ?,
                external_call_id = ?,
                recording_url = ?,
                ip_number = ?,
                agent = ?,
                updated_at = NOW()
          WHERE id = ?`,
        [
          dbStatus,
          log.duration || 0,
          String(log.id),
          log.recording || null,
          log.ipnumber || null,
          log.agent || null,
          row.id,
        ]
      );

      if (result.affectedRows > 0) {
        updated += 1;
        touchedCampaigns.add(row.campaign_id);
        console.log(`[IPCallSync] ✅ Row ${row.id} (${row.phone_number}) → ${dbStatus}`);
      }
    }

    // ✅ Recalculate calls_completed for touched campaigns
    for (const campaignId of touchedCampaigns) {
      await db.query(
        `UPDATE campaigns c
            SET c.calls_completed = (
              SELECT COUNT(*) FROM campaign_numbers
              WHERE campaign_id = c.id AND status = 'completed'
            ),
            c.updated_at = NOW()
          WHERE c.id = ?`,
        [campaignId]
      );

      // Mark campaign completed if no pending calls
      const [[summary]] = await db.query(
        `SELECT SUM(CASE WHEN status IN ('queued','ringing','in-progress') THEN 1 ELSE 0 END) AS pending
           FROM campaign_numbers WHERE campaign_id = ?`,
        [campaignId]
      );

      if ((summary?.pending || 0) === 0) {
        await db.query(
          `UPDATE campaigns SET status = 'completed', updated_at = NOW() WHERE id = ?`,
          [campaignId]
        );
        console.log(`[IPCallSync] Campaign ${campaignId} marked completed`);
      }
    }

    console.log(`[IPCallSync] ✅ fetched=${allLogs.length} updated=${updated}`);
    return { fetched: allLogs.length, updated };
  } catch (err) {
    console.error('[IPCallSync] error:', err.message);
    return { error: err.message };
  }
}

// ============================================================
// Get call logs for frontend
// ============================================================
async function getIpcallCallLogs(filters = {}) {
  const apiKey = await getApiKey();

  const url = new URL(`${IPCALL_BASE}/calllogs/`);
  url.searchParams.set('apikey', apiKey);

  if (filters.mobile) url.searchParams.set('mobile', filters.mobile);
  if (filters.status) url.searchParams.set('status', filters.status);
  if (filters.agent) url.searchParams.set('agent', filters.agent);
  if (filters.call_type) url.searchParams.set('call_type', filters.call_type);
  if (filters.date_from) url.searchParams.set('date_from', filters.date_from);
  if (filters.date_to) url.searchParams.set('date_to', filters.date_to);
  url.searchParams.set('page', String(filters.page || 1));
  url.searchParams.set('per_page', String(filters.per_page || 50));

  const { data } = await axios.get(url.toString(), { timeout: 30000 });
  return data;
}

module.exports = { fetchCallLogs, syncRecentCalls, getIpcallCallLogs };