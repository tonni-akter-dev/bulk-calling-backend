const voiceFileService = require('../services/voiceFileService');

async function getVoiceFiles(req, res) {
  const files = await voiceFileService.getVoiceFiles(req.user.companyId, req.query);
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
    message: 'Voice file uploaded successfully',
    data: newFile,
  });
}

async function deleteVoiceFile(req, res) {
  await voiceFileService.deleteVoiceFile(req.user.companyId, req.params.id);
  res.json({
    success: true,
    message: 'Voice file deleted successfully',
  });
}

module.exports = { getVoiceFiles, uploadVoiceFile, deleteVoiceFile };