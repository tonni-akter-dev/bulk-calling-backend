const db = require('../config/db');
const { encrypt, decrypt, maskSecret } = require('../utils/crypto');

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

// Used by services (decrypted key)
async function getIpcallApiKey() {
  if (cache && Date.now() - cacheAt < TTL) return cache.apiKey;

  const raw = await loadRaw();
  const row = raw['ipcall_api_key'];

  let apiKey = null;
  if (row && row.setting_value) {
    try {
      apiKey = decrypt(row.setting_value);
    } catch (e) {
      console.error('[settings] decrypt failed:', e.message);
    }
  }

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

// For admin UI (masked)
async function getPublicSettings() {
  const raw = await loadRaw();
  const keyRow = raw['ipcall_api_key'];

  let masked = '';
  let hasKey = false;
  if (keyRow && keyRow.setting_value) {
    try {
      const real = decrypt(keyRow.setting_value);
      masked = maskSecret(real);
      hasKey = true;
    } catch {
      masked = '••••error';
    }
  }

  return {
    hasApiKey: hasKey,
    maskedApiKey: masked,
    delaySeconds: Number(raw['ipcall_delay_seconds']?.setting_value || 38),
    maxBatchSize: Number(raw['ipcall_max_batch_size']?.setting_value || 20),
    updatedAt: keyRow?.updated_at || null,
  };
}

async function updateSettings(adminUserId, { apiKey, delaySeconds, maxBatchSize }) {
  const jobs = [];

  if (apiKey && String(apiKey).trim()) {
    const enc = encrypt(String(apiKey).trim());
    jobs.push(
      db.query(
        `UPDATE app_settings
         SET setting_value = ?, updated_by = ?, updated_at = NOW()
         WHERE setting_key = 'ipcall_api_key'`,
        [enc, adminUserId]
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