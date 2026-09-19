// src/services/settingsService.js
const db = require('../config/db');

// ============================================================
// Load raw settings from DB — always fresh, no cache
// ============================================================
async function loadRaw() {
  const [rows] = await db.query(
    `SELECT setting_key, setting_value, is_secret, updated_at
     FROM app_settings`
  );
  const map = {};
  for (const r of rows) map[r.setting_key] = r;
  return map;
}

// ============================================================
// Get API key — Direct DB read, no cache
// ============================================================
async function getIpcallApiKey() {
  const raw = await loadRaw();

  const keyRow = raw['ipcall_api_key'];
  const apiKey = keyRow?.setting_value
    ? String(keyRow.setting_value).trim()
    : '';

  console.log('🔑 [settings] getIpcallApiKey →', {
    found: !!keyRow,
    hasValue: !!apiKey,
    keyLength: apiKey.length,
    keyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : '(empty)',
    keySuffix: apiKey ? '...' + apiKey.slice(-10) : '(empty)',
    rawLength: keyRow?.setting_value?.length || 0,
  });

  if (!apiKey) {
    console.warn('⚠️ [settings] IPCall API key not found in DB');
  }

  return apiKey;
}

// ============================================================
// Get delay seconds — Direct DB read
// ============================================================
async function getDelaySeconds() {
  const raw = await loadRaw();
  return Number(raw['ipcall_delay_seconds']?.setting_value || 38);
}

// ============================================================
// Get max batch size — Direct DB read
// ============================================================
async function getMaxBatchSize() {
  const raw = await loadRaw();
  return Number(raw['ipcall_max_batch_size']?.setting_value || 20);
}

// ============================================================
// Public settings
// ============================================================
async function getPublicSettings() {
  const raw = await loadRaw();
  const keyRow = raw['ipcall_api_key'];

  const apiKey = keyRow?.setting_value
    ? String(keyRow.setting_value).trim()
    : '';

  return {
    hasApiKey: !!apiKey,
    apiKey: apiKey,
    delaySeconds: Number(raw['ipcall_delay_seconds']?.setting_value || 38),
    maxBatchSize: Number(raw['ipcall_max_batch_size']?.setting_value || 20),
    updatedAt: keyRow?.updated_at || null,
  };
}

// ============================================================
// Save — UPSERT (row না থাকলেও insert হবে)
// ============================================================
async function updateSettings(adminUserId, { apiKey, delaySeconds, maxBatchSize }) {
  const jobs = [];

  if (apiKey && String(apiKey).trim()) {
    const cleanKey = String(apiKey).trim().replace(/\s+/g, '');

    console.log('🔑 [settings] Saving key (len=' + cleanKey.length + ')');

    jobs.push(
      db.query(
        `INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at)
         VALUES ('ipcall_api_key', ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           setting_value = VALUES(setting_value),
           updated_by = VALUES(updated_by),
           updated_at = NOW()`,
        [cleanKey, adminUserId]
      )
    );
  }

  if (delaySeconds !== undefined && delaySeconds !== null) {
    const n = Math.max(1, Math.min(600, Number(delaySeconds)));
    jobs.push(
      db.query(
        `INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at)
         VALUES ('ipcall_delay_seconds', ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           setting_value = VALUES(setting_value),
           updated_by = VALUES(updated_by),
           updated_at = NOW()`,
        [String(n), adminUserId]
      )
    );
  }

  if (maxBatchSize !== undefined && maxBatchSize !== null) {
    const n = Math.max(1, Math.min(100, Number(maxBatchSize)));
    jobs.push(
      db.query(
        `INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at)
         VALUES ('ipcall_max_batch_size', ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           setting_value = VALUES(setting_value),
           updated_by = VALUES(updated_by),
           updated_at = NOW()`,
        [String(n), adminUserId]
      )
    );
  }

  await Promise.all(jobs);
  return getPublicSettings();
}

// ============================================================
// Legacy exports (kept for backward compatibility)
// ============================================================
function invalidateCache() {
  // No-op now — cache removed
  console.log('ℹ️ [settings] invalidateCache() called — no cache to clear');
}

module.exports = {
  getIpcallApiKey,
  getDelaySeconds,
  getMaxBatchSize,
  getPublicSettings,
  updateSettings,
  invalidateCache,   // kept as no-op for compatibility
};