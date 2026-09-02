const db = require('../config/db');
const fs = require('fs').promises;
const path = require('path');

async function getVoiceFiles(companyId, { search = '', filter = '' }) {
  let whereConditions = [`c.company_id = ?`];
  let params = [companyId];

  if (search) {
    whereConditions.push(`af.original_name LIKE ?`);
    params.push(`%${search}%`);
  }

  if (filter) {
    whereConditions.push(`af.format = ?`);
    params.push(filter);
  }

  const whereClause = whereConditions.join(' AND ');

  const [files] = await db.query(
    `SELECT 
      af.id,
      af.original_name AS name,
      COALESCE(c.name, 'N/A') AS campaignName,
      af.format,
      af.file_size_mb AS size,
      af.public_url AS url,
      af.created_at AS createdAt
     FROM audio_files af
     LEFT JOIN campaigns c ON af.company_id = c.company_id AND af.id = c.audio_file_id
     WHERE ${whereClause}
     ORDER BY af.id DESC`,
    params
  );

  return files.map((file, index) => ({
    sn: index + 1,
    id: file.id,
    name: file.name,
    campaignName: file.campaignName,
    format: (file.format || 'MP3').toUpperCase(),
    size: `${file.size || 0} MB`,
    url: file.url,
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

  const [result] = await db.query(
    `INSERT INTO audio_files (company_id, original_name, stored_path, format, file_size_mb, public_url) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [companyId, fileName, file.path, extension, fileSizeMb, publicUrl]
  );

  return {
    id: result.insertId,
    name: fileName,
    format: extension.toUpperCase(),
    size: `${fileSizeMb} MB`,
    url: publicUrl,
  };
}

async function deleteVoiceFile(companyId, fileId) {
  const [[file]] = await db.query(
    `SELECT stored_path FROM audio_files WHERE id = ? AND company_id = ?`,
    [fileId, companyId]
  );

  if (!file) throw new Error('Audio file not found');

  // Remove from filesystem
  try {
    await fs.unlink(file.stored_path);
  } catch (err) {
    console.warn(`File deletion error from disk: ${err.message}`);
  }

  // Remove from DB
  await db.query(`DELETE FROM audio_files WHERE id = ? AND company_id = ?`, [fileId, companyId]);

  return true;
}

module.exports = { getVoiceFiles, uploadVoiceFile, deleteVoiceFile };