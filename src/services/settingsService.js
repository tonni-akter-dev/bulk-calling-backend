const db = require('../config/db');

let cache = null;
let cacheAt = 0;
const TTL = 60_000; // 60s

function invalidateCache() {
  cache = null;
  cacheAt = 0;
}

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
// Get API key — direct read, no encryption
// ============================================================

async function getIpcallApiKey() {
  const raw = await loadRaw();


  cache = {
    apiKey,
    delaySeconds: Number(raw['ipcall_delay_seconds']?.setting_value || 38),
    maxBatchSize: Number(raw['ipcall_max_batch_size']?.setting_value || 20),
  };
  cacheAt = Date.now();
  return apiKey;
}

async function getDelaySeconds() {
  if (!cache) await getIpcallApiKey();
  return cache?.delaySeconds ?? 38;
}

async function getMaxBatchSize() {
  if (!cache) await getIpcallApiKey();
  return cache?.maxBatchSize ?? 20;
}

// ============================================================
// Public settings — returns FULL key (no masking)
// ============================================================

async function getPublicSettings() {
  const raw = await loadRaw();
  const keyRow = raw['ipcall_api_key'];

  const apiKey = keyRow?.setting_value
    ? String(keyRow.setting_value).trim()
    : '';

  return {
    hasApiKey: !!apiKey,
    apiKey: apiKey,               // ✅ full key returned (no mask)
    delaySeconds: Number(raw['ipcall_delay_seconds']?.setting_value || 38),
    maxBatchSize: Number(raw['ipcall_max_batch_size']?.setting_value || 20),
    updatedAt: keyRow?.updated_at || null,
  };
}

// ============================================================
// Save — plain text, no encryption
// ============================================================

async function updateSettings(adminUserId, { apiKey, delaySeconds, maxBatchSize }) {
  const jobs = [];

  if (apiKey && String(apiKey).trim()) {
    const cleanKey = String(apiKey).trim().replace(/\s+/g, '');

    console.log('🔑 [settings] Saving key:', cleanKey);

    jobs.push(
      db.query(
        `UPDATE app_settings
         SET setting_value = ?, updated_by = ?, updated_at = NOW()
         WHERE setting_key = 'ipcall_api_key'`,
        [cleanKey, adminUserId]
      )
    );
  }

  if (delaySeconds !== undefined && delaySeconds !== null) {
    const n = Math.max(1, Math.min(600, Number(delaySeconds)));
    jobs.push(
      db.query(
        `UPDATE app_settings
         SET setting_value = ?, updated_by = ?, updated_at = NOW()
         WHERE setting_key = 'ipcall_delay_seconds'`,
        [String(n), adminUserId]
      )
    );
  }

  if (maxBatchSize !== undefined && maxBatchSize !== null) {
    const n = Math.max(1, Math.min(100, Number(maxBatchSize)));
    jobs.push(
      db.query(
        `UPDATE app_settings
         SET setting_value = ?, updated_by = ?, updated_at = NOW()
         WHERE setting_key = 'ipcall_max_batch_size'`,
        [String(n), adminUserId]
      )
    );
  }

  await Promise.all(jobs);
  invalidateCache();
  return getPublicSettings();
}

module.exports = {
  getIpcallApiKey,
  getDelaySeconds,
  getMaxBatchSize,
  getPublicSettings,
  updateSettings,
  invalidateCache,
};