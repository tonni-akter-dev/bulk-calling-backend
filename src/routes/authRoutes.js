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


// // routes/auth.js
// const express = require('express');
// const router = express.Router();

// const {
//   createUser,
//   signup,
//   login,
//   getMe,
//   getAllUsers,
//   // verification
//   sendEmailVerificationCode,
//   confirmEmailVerification,
//   sendPhoneVerificationCode,
//   confirmPhoneVerification,
//   // password reset
//   forgotPassword,
//   verifyResetCode,
//   resetPassword
// } = require('../controllers/authController');

// const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
// const asyncHandler = require('../utils/asyncHandler');

// /* ---------------- Public routes ---------------- */
// router.post('/signup', asyncHandler(signup));
// router.post('/login', asyncHandler(login));

// router.post('/forgot-password', asyncHandler(forgotPassword));
// router.post('/verify-reset-code', asyncHandler(verifyResetCode));
// router.post('/reset-password', asyncHandler(resetPassword));

// /* ---------------- Protected routes ---------------- */
// router.get('/me', requireAuth, asyncHandler(getMe));

// // Email verification
// router.post('/verify/email/send',    requireAuth, asyncHandler(sendEmailVerificationCode));
// router.post('/verify/email/confirm', requireAuth, asyncHandler(confirmEmailVerification));

// // Phone verification
// router.post('/verify/phone/send',    requireAuth, asyncHandler(sendPhoneVerificationCode));
// router.post('/verify/phone/confirm', requireAuth, asyncHandler(confirmPhoneVerification));

// /* ---------------- Super Admin only ---------------- */
// router.post('/users', requireAuth, requireSuperAdmin, asyncHandler(createUser));
// router.get('/users',  requireAuth, requireSuperAdmin, asyncHandler(getAllUsers));

// module.exports = router;