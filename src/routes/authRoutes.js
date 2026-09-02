const express = require('express');
const router = express.Router();
const { signup, login } = require('../controllers/authController');
const asyncHandler = require('../utils/asyncHandler');

router.post('/signup', asyncHandler(signup));
router.post('/login', asyncHandler(login));

module.exports = router;