const express = require('express');
const router = express.Router();
const { requireAuth, requireActiveSubscription } = require('../middleware/auth');
const { uploadAudio } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/voiceFileController');

router.use(requireAuth, requireActiveSubscription);

// Get audio files list with filter/search
router.get('/', asyncHandler(ctrl.getVoiceFiles));

// Upload new voice file (multipart/form-data: field name "file" & body "fileName")
router.post('/upload', uploadAudio.single('file'), asyncHandler(ctrl.uploadVoiceFile));

// Delete voice file by ID
router.delete('/:id', asyncHandler(ctrl.deleteVoiceFile));

module.exports = router;