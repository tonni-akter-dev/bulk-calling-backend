// src/services/voiceFileService.js
const db = require('../config/db');
const fs = require('fs').promises;
const path = require('path');
const settingsService = require('./settingsService');   // 🆕

// ============================================
// IP Call BD helper — DB key use
// ============================================
async function registerWithIpcall({ voice_name, audio_url }) {
  const apiKey = await settingsService.getIpcallApiKey();
  if (!apiKey) throw new Error('IPCall API key not configured. Set it in Admin → Settings.');

  const url = new URL('https://ipcall.bd/voiceapi/uploadvoice/');
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('voice_name', voice_name);
  url.searchParams.set('audio_url', audio_url);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.status !== 'success' || !data.campaign_id) {
    throw new Error(data.message || 'IP Call BD upload failed');
  }

  return data;
}

async function getVoiceFiles(companyId) {
  const [files] = await db.query(
    `SELECT
      af.id,
      af.original_name AS name,
      af.format,
      af.file_size_mb AS size,
      af.public_url AS url,
      af.campaign_id AS campaignId,
      af.created_at AS createdAt
    FROM audio_files af
    WHERE af.company_id = ?
    ORDER BY af.id DESC`,
    [companyId]
  );

  return files.map((file, index) => ({
    sn: index + 1,
    id: file.id,
    name: file.name,
    format: (file.format || 'MP3').toUpperCase(),
    size: `${file.size || 0} MB`,
    url: file.url,
    campaignId: file.campaignId || null,
    createdAt: file.createdAt,
  }));
}

async function uploadVoiceFile(companyId, { fileName, file }) {
  if (!fileName) throw new Error('File name is required');
  if (!file) throw new Error('Audio file is required');

  const extension = path.extname(file.originalname).replace('.', '').toLowerCase();
  const allowedFormats = ['mp3', 'wav', 'ogg'];
  if (!allowedFormats.includes(extension)) {
    throw new Error('Unsupported format. Allowed: mp3, wav, ogg');
  }

  const fileSizeMb = (file.size / (1024 * 1024)).toFixed(1);
  const publicUrl = `${process.env.BASE_URL}/uploads/audio/${file.filename}`;

  let campaignId = null;
  try {
    const ipcall = await registerWithIpcall({
      voice_name: fileName,
      audio_url: publicUrl,
    });
    campaignId = ipcall.campaign_id;
  } catch (err) {
    try {
      await fs.unlink(file.path);
    } catch (_) {}
    throw new Error(`IPCall register failed: ${err.message}`);
  }

  const [result] = await db.query(
    `INSERT INTO audio_files
      (company_id, original_name, stored_path, format, file_size_mb, public_url, campaign_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [companyId, fileName, file.path, extension, fileSizeMb, publicUrl, campaignId]
  );

  return {
    id: result.insertId,
    name: fileName,
    format: extension.toUpperCase(),
    size: `${fileSizeMb} MB`,
    url: publicUrl,
    campaignId,
  };
}

async function deleteVoiceFile(companyId, fileId) {
  const [[file]] = await db.query(
    `SELECT stored_path FROM audio_files WHERE id = ? AND company_id = ?`,
    [fileId, companyId]
  );

  if (!file) throw new Error('Audio file not found');

  try {
    await fs.unlink(file.stored_path);
  } catch (err) {
    console.warn(`File deletion error from disk: ${err.message}`);
  }

  await db.query(
    `DELETE FROM audio_files WHERE id = ? AND company_id = ?`,
    [fileId, companyId]
  );

  return true;
}

module.exports = { getVoiceFiles, uploadVoiceFile, deleteVoiceFile };