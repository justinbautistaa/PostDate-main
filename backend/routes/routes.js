const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { getMe, getAdminPing } = require("../controllers/controller");

const router = express.Router();
router.get("/stats", asyncHandler(async (req, res) => {
  const User = require("../models/User");
  const Match = require("../models/Match");
  const [members, matches, active] = await Promise.all([
    User.countDocuments({ role: "user", isActive: true, isVerified: true, emailVerifiedAt: { $ne: null } }),
    Match.countDocuments({ status: "active" }),
    User.countDocuments({ role: "user", isActive: true, isVerified: true, emailVerifiedAt: { $ne: null }, lastActiveAt: { $gte: new Date(Date.now() - 300000) } }),
  ]);
  res.json([{ label: "verified members", value: members }, { label: "active matches", value: matches }, { label: "members active recently", value: active }]);
}));

// Mounted at /api in server.js. This file was an empty placeholder before —
// these two routes are worked examples of requireAuth / requireRole (see
// the note at the top of controllers/controller.js). Add real routes here
// the same way:
//
//   router.METHOD(path, requireAuth, [requireRole(...role),] asyncHandler(fn))

// Any logged-in user
router.get("/profile/me", requireAuth, asyncHandler(getMe));

// Admins and moderators only
router.get(
  "/admin/ping",
  requireAuth,
  requireRole("admin", "moderator"),
  asyncHandler(getAdminPing)
);

module.exports = router;
