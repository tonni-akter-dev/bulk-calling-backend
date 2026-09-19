// src/services/ipcallSyncService.js
const axios = require('axios');
const db = require('../config/db');
const settingsService = require('./settingsService');   // 🆕

const IPCALL_BASE = process.env.IPCALL_BASE_URL || 'https://ipcall.bd/voiceapi';

// ============================================================
// Helper
// ============================================================
async function getApiKey() {
  const apiKey = await settingsService.getIpcallApiKey();
  if (!apiKey) throw new Error('IPCall API key not configured');
  return apiKey;
}

function mapIpcallStatusToDb(ipcallStatus) {
  const s = String(ipcallStatus || '').toLowerCase().trim();
  if (s === 'answered') return 'completed';
  if (s === 'busy') return 'busy';
  if (s === 'no answer') return 'no-answer';
  if (s === 'missed') return 'failed';
  if (s === 'failed') return 'failed';
  return 'completed';
}

// ============================================================
// Fetch /calllogs/
// ============================================================
async function fetchCallLogs({ date_from, date_to, page = 1, per_page = 200 } = {}) {
  const apiKey = await getApiKey();   // ✅ DB থেকে

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
// Sync recent calls
// ============================================================
async function syncRecentCalls() {
  try {
    const [rows] = await db.query(
      `SELECT id, external_call_id
         FROM campaign_numbers
        WHERE external_call_id IS NOT NULL
          AND (duration_seconds IS NULL OR duration_seconds = 0 OR recording_url IS NULL)
          AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        LIMIT 500`
    );

    if (!rows.length) {
      return { synced: 0, message: 'Nothing to sync' };
    }

    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const allLogs = [];
    let page = 1;

    while (true) {
      const resp = await fetchCallLogs({
        date_from: sevenDaysAgo,
        date_to: today,
        page,
        per_page: 200,
      });

      if (!resp || resp.status !== 'success' || !Array.isArray(resp.data)) break;
      allLogs.push(...resp.data);

      if (page >= (resp.total_pages || 1)) break;
      page += 1;
    }

    const logMap = new Map(allLogs.map((l) => [String(l.id), l]));

    let updated = 0;
    for (const row of rows) {
      const log = logMap.get(String(row.external_call_id));
      if (!log) continue;

      const [result] = await db.query(
        `UPDATE campaign_numbers
           SET duration_seconds = ?,
               status = ?,
               recording_url = ?,
               ip_number = ?,
               agent = ?,
               updated_at = NOW()
         WHERE external_call_id = ?`,
        [
          log.duration || 0,
          mapIpcallStatusToDb(log.status),
          log.recording || null,
          log.ipnumber || null,
          log.agent || null,
          String(row.external_call_id),
        ]
      );

      if (result.affectedRows > 0) updated += 1;
    }

    console.log(`[IPCallSync] fetched=${allLogs.length} updated=${updated}`);
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
  const apiKey = await getApiKey();   // ✅ DB থেকে

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