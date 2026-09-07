const express = require('express');
const router = express.Router();
const { 
  createUser,
  signup, 
  login,
  getMe,
  getAllUsers 
} = require('../controllers/authController');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

// Public routes
router.post('/signup', asyncHandler(signup));
router.post('/login', asyncHandler(login));

// Protected routes
router.get('/me', requireAuth, asyncHandler(getMe));

// Super Admin only routes
router.post('/users', requireAuth, requireSuperAdmin, asyncHandler(createUser));
router.get('/users', requireAuth, requireSuperAdmin, asyncHandler(getAllUsers));

module.exports = router;