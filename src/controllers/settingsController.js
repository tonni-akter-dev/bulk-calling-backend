const settingsService = require('../services/settingsService');

async function getIpcallSettings(req, res) {
  try {
    const data = await settingsService.getPublicSettings();
    res.json({ success: true, data });
  } catch (err) {
    console.error('getIpcallSettings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateIpcallSettings(req, res) {
  try {
    const { apiKey, delaySeconds, maxBatchSize } = req.body;

    const data = await settingsService.updateSettings(req.user.userId, {
      apiKey,
      delaySeconds,
      maxBatchSize,
    });

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data,
    });
  } catch (err) {
    console.error('updateIpcallSettings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getIpcallSettings, updateIpcallSettings };