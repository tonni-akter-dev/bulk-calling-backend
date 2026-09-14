const voiceFileService = require("../services/voiceFileService");
const campaignService = require("../services/campaignService"); // 🆕 যোগ করো
const db = require("../config/db"); // 🆕 যোগ করো

async function getVoiceFiles(req, res) {
  const files = await voiceFileService.getVoiceFiles(req.user.companyId);

  res.json({
    success: true,
    total: files.length,
    data: files,
  });
}

async function uploadVoiceFile(req, res) {
  const newFile = await voiceFileService.uploadVoiceFile(req.user.companyId, {
    fileName: req.body.fileName,
    file: req.file,
  });
  res.status(201).json({
    success: true,
    message: "Voice file uploaded successfully",
    data: newFile,
  });
}

async function registerVoiceByUrl(req, res) {
  const { voice_name, audio_url } = req.body;

  if (!voice_name || !audio_url) {
    return res
      .status(400)
      .json({ success: false, message: "voice_name and audio_url required" });
  }

  // IP Call BD এ register
  const reg = await campaignService.registerVoiceWithIpcall({
    voice_name,
    audio_url,
  });

  // DB এ save
  const [result] = await db.query(
    `INSERT INTO audio_files
       (company_id, original_name, public_url, format, campaign_id)
     VALUES (?, ?, ?, ?, ?)`,
    [
      req.user.companyId,
      voice_name,
      audio_url,
      (audio_url.split(".").pop() || "mp3").toLowerCase(),
      reg.campaignId,
    ],
  );

  res.json({
    success: true,
    data: { id: result.insertId, campaignId: reg.campaignId },
  });
}
async function deleteVoiceFile(req, res) {
  await voiceFileService.deleteVoiceFile(req.user.companyId, req.params.id);
  res.json({
    success: true,
    message: "Voice file deleted successfully",
  });
}

module.exports = {
  getVoiceFiles,
  uploadVoiceFile,
  deleteVoiceFile,
  registerVoiceByUrl,
};
