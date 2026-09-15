const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/settingsController');

// Only admin / super_admin
router.use(requireAuth, requireAdmin);

router.get('/ipcall', asyncHandler(ctrl.getIpcallSettings));
router.put('/ipcall', asyncHandler(ctrl.updateIpcallSettings));

module.exports = router;