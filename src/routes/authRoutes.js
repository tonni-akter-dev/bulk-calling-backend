const express = require("express");
const router = express.Router();
const {
  createUser,
  signup,
  login,
  getMe,
  getAllUsers,
  updateProfile,
  logout, // 🆕
} = require("../controllers/authController");
const { requireAuth, requireSuperAdmin } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

router.post("/signup", asyncHandler(signup));
router.post("/login", asyncHandler(login));
router.post("/logout", asyncHandler(logout));
router.get("/me", requireAuth, asyncHandler(getMe));
router.post("/users", requireAuth, requireSuperAdmin, asyncHandler(createUser));
router.get("/users", requireAuth, requireSuperAdmin, asyncHandler(getAllUsers));
router.put("/update-profile", requireAuth, asyncHandler(updateProfile));

module.exports = router;
