const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const Profile = require("../models/Profile"), User = require("../models/User");
const { authLimiter } = require("../middleware/rateLimiter");
router.use("/privacy", requireAuth);
router.post("/privacy/delete-account", authLimiter, asyncHandler(async (req, res) => {
  const { password, code, confirmation } = req.body || {};
  if (confirmation !== "DELETE" || typeof password !== "string" || Buffer.byteLength(password) > 72) return res.status(400).json({ message: "Enter your password and type DELETE to confirm." });
  const user = await User.findById(req.user.userId).select("+passwordHash +sessionVersion +mfaSecret +mfaLastCounter +mfaRecoveryHashes");
  if (user.role !== "user") return res.status(403).json({ message: "Staff accounts must be handled by the administration team so access can be transferred safely." });
  if (!await require("bcryptjs").compare(password, user.passwordHash)) return res.status(403).json({ message: "Your current password is incorrect." });
  if (user.mfaEnabled && !await require("./mfaRoutes").consumeFactor(user, code)) return res.status(403).json({ message: "Enter a fresh authenticator code or an unused recovery code." });
  await require("../utils/accountDeletion").requestDeletion(user);
  require("../utils/session").clearSession(res);
  res.status(202).json({ message: "Your account is closed. Permanent cleanup is queued and retries automatically. Moderation records and historical backups may be retained as described in the privacy notice." });
}));
router.post("/privacy/acknowledge", asyncHandler(async (req, res) => {
  if (req.body?.consent !== true) return res.status(400).json({ message: "Acknowledge the privacy notice to continue." });
  await User.updateOne({ _id: req.user.userId }, { $set: { privacyConsentAt: new Date(), privacyPolicyVersion: "2026-10-16" } });
  res.json({ acknowledged: true });
}));
router.get("/privacy/settings", asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ userId: req.user.userId }).select("discoverable").lean();
  const user = await User.findById(req.user.userId).select("privacyConsentAt privacyPolicyVersion").lean();
  res.json({ discoverable: profile?.discoverable !== false, consentAt: user.privacyConsentAt, policyVersion: user.privacyPolicyVersion });
}));
router.put("/privacy/settings", asyncHandler(async (req, res) => {
  if (Object.keys(req.body).some(key => key !== "discoverable") || typeof req.body.discoverable !== "boolean") return res.status(400).json({ message: "Choose whether your profile appears in discovery." });
  const profile = await Profile.findOneAndUpdate({ userId: req.user.userId }, { $set: { discoverable: req.body.discoverable } }, { new: true });
  if (!profile) return res.status(404).json({ message: "Profile not found" });
  res.json({ discoverable: profile.discoverable });
}));
router.get("/privacy/export", asyncHandler(async (req, res) => {
  const id = req.user.userId;
  const [account, profile, reports, sentMessages, plans] = await Promise.all([
    User.findById(id).select("email firstName middleName lastName createdAt privacyConsentAt privacyPolicyVersion").lean(),
    Profile.findOne({ userId: id }).select("profileName dateOfBirth gender bio location interests lookingFor photos avatar discoverable createdAt updatedAt").lean(),
    require("../models/Report").find({ reporterId: id }).select("reason description targetType status createdAt resolvedAt").sort({ _id: -1 }).limit(500).lean(),
    require("../models/Message").find({ senderId: id }).select("message createdAt matchId").sort({ _id: -1 }).limit(500).lean(),
    require("../models/WorkspaceEntry").find({ owner: id, kind: "plan" }).select("title body when done createdAt").sort({ _id: -1 }).limit(500).lean(),
  ]);
  res.set("Content-Disposition", 'attachment; filename="postdate-my-data.json"');
  res.json({ exportedAt: new Date(), account, profile, reports, sentMessages, plans, scope: "Reports, sent messages and plans include up to 500 recent entries each. Other people's messages, private moderation notes, password hashes and MFA secrets are excluded." });
}));
module.exports = router;
