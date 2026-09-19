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
  try {
    const { voice_name, audio_url } = req.body;

    if (!voice_name || !audio_url) {
      return res.status(400).json({
        success: false,
        message: "voice_name and audio_url required",
      });
    }

    const result = await campaignService.registerVoiceByUrl(
      req.user.companyId,
      { voice_name, audio_url }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("registerVoiceByUrl error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
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
