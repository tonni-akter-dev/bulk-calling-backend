const express = require('express');
const router = express.Router();
const { requireAuth, requireActiveSubscription } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/contactFormController');

router.post('/', asyncHandler(ctrl.submitForm)); // ✅ Now matches export
router.use(requireAuth, requireActiveSubscription);
router.get('/', asyncHandler(ctrl.listMessages)); // ✅ Now matches export
router.patch('/:id/read', asyncHandler(ctrl.markAsRead)); // ✅ Now matches export

module.exports = router;