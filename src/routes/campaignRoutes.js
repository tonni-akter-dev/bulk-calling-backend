const express = require('express');
const router = express.Router();
const { requireAuth, requireActiveSubscription } = require('../middleware/auth');
const { uploadAudio } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/campaignController');

router.use(requireAuth, requireActiveSubscription);

// Launch campaign with voice clip file attachment
router.post('/launch', uploadAudio.single('file'), asyncHandler(ctrl.launchCampaign));

// Fetch real-time live call logs and counter stats
router.get('/live-logs', asyncHandler(ctrl.getLiveLogs));

module.exports = router;