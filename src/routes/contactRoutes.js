const express = require('express');
const router = express.Router();
const { requireAuth, requireActiveSubscription } = require('../middleware/auth');
const { uploadCsv } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/contactController');

router.use(requireAuth, requireActiveSubscription);

router.get('/', asyncHandler(ctrl.listContacts));
router.post('/', asyncHandler(ctrl.createContact));
router.post('/import-csv', uploadCsv.single('file'), asyncHandler(ctrl.importCsv));
router.put('/:id', asyncHandler(ctrl.updateContact));
router.delete('/:id', asyncHandler(ctrl.deleteContact));

module.exports = router;