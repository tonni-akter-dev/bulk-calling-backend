const express = require('express');
const router = express.Router();
const { requireAuth, requireActiveSubscription, requireAdmin } = require('../middleware/auth');
const { uploadAudio } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/campaignController');

// All routes require auth
router.use(requireAuth);

// Launch campaign with voice clip file attachment
router.post('/launch', requireActiveSubscription, uploadAudio.single('file'), asyncHandler(ctrl.launchCampaign));

// Get campaign stats
router.get('/stats', asyncHandler(ctrl.getCampaignStats));

// Get all campaigns
router.get('/', asyncHandler(ctrl.getAllCampaigns));

// Get live call logs
router.get('/live-logs', asyncHandler(ctrl.getLiveLogs));

// Get single campaign details
router.get('/:id', asyncHandler(ctrl.getCampaignById));

// Update campaign status (pause, resume, cancel)
router.patch('/:id/status', asyncHandler(ctrl.updateCampaignStatus));

// Delete campaign
router.delete('/:id', asyncHandler(ctrl.deleteCampaign));

module.exports = router;