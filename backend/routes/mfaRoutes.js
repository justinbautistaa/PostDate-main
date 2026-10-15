const router = require("express").Router();
const bcrypt = require("bcryptjs"), crypto = require("crypto");
const User = require("../models/User"), Challenge = require("../models/MfaChallenge");
const mfa = require("../utils/mfa");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { asyncHandler } = require("../middleware/errorHandler");
const { setSession } = require("../utils/session");
const secretFields = "+passwordHash +sessionVersion +mfaSecret +mfaLastCounter +mfaRecoveryHashes";
const bad = res => res.status(401).json({ message: "Invalid or expired authentication code. Try a new code or a recovery code." });
router.get("/auth/mfa/status", requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select("mfaEnabled role");
  res.json({ enabled: user.mfaEnabled, required: mfa.staffRequired(user.role) });
}));
router.post("/auth/mfa/enroll", authLimiter, requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select(secretFields);
  if (typeof req.body?.password !== "string" || Buffer.byteLength(req.body.password) > 72 || !await bcrypt.compare(req.body.password, user.passwordHash)) return bad(res);
  if (user.mfaEnabled) return res.status(409).json({ message: "MFA is already enabled." });
  try { res.json(await mfa.begin(user, true)); } catch { res.status(503).json({ message: "MFA is not configured on this server." }); }
}));
async function consumeFactor(user, code) {
  const filter = { _id: user._id, sessionVersion: user.sessionVersion || 0, mfaEnabled: true };
  if (typeof code !== "string") return null;
  if (/^[a-f\d]{24}$/i.test(code)) return User.findOneAndUpdate({ ...filter, mfaRecoveryHashes: mfa.hash(code.toLowerCase()) }, { $pull: { mfaRecoveryHashes: mfa.hash(code.toLowerCase()) } }, { new: true }).select(secretFields);
  const counter = mfa.counter(mfa.decrypt(user.mfaSecret), code);
  if (counter === null) return null;
  return User.findOneAndUpdate({ ...filter, mfaLastCounter: { $lt: counter } }, { $set: { mfaLastCounter: counter } }, { new: true }).select(secretFields);
}
router.post("/auth/mfa/verify", authLimiter, asyncHandler(async (req, res) => {
  const { challenge, code } = req.body || {};
  if (typeof challenge !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return bad(res);
  const pending = await Challenge.findOneAndUpdate({ tokenHash: mfa.hash(challenge), expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } }, { new: true });
  if (!pending) return bad(res);
  let user = await User.findOne({ _id: pending.userId, isActive: true, isVerified: true, sessionVersion: pending.version }).select(secretFields);
  if (!user || (user.role === "user" && !user.emailVerifiedAt)) return bad(res);
  let recoveryCodes;
  if (pending.enroll) {
    if (user.mfaEnabled) return bad(res);
    const counter = mfa.counter(mfa.decrypt(pending.secret), code);
    if (counter === null) return bad(res);
    recoveryCodes = Array.from({ length: 8 }, () => crypto.randomBytes(12).toString("hex"));
    user = await User.findOneAndUpdate({ _id: user._id, sessionVersion: pending.version, mfaEnabled: { $ne: true } }, { $set: { mfaEnabled: true, mfaSecret: pending.secret, mfaLastCounter: counter, mfaRecoveryHashes: recoveryCodes.map(mfa.hash) }, $inc: { sessionVersion: 1 } }, { new: true }).select("+sessionVersion");
  } else user = await consumeFactor(user, code);
  if (!user) return bad(res);
  const consumed = await Challenge.findOneAndDelete({ _id: pending._id });
  if (!consumed) return bad(res);
  setSession(res, user, true);
  res.json({ userId: user._id, role: user.role, ...(recoveryCodes ? { recoveryCodes } : {}) });
}));
router.post("/auth/mfa/disable", authLimiter, requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select(secretFields);
  if (mfa.staffRequired(user.role)) return res.status(403).json({ message: "MFA is required for staff and administrators in production." });
  if (!user.mfaEnabled || typeof req.body?.password !== "string" || Buffer.byteLength(req.body.password) > 72 || !await bcrypt.compare(req.body.password, user.passwordHash) || !await consumeFactor(user, req.body.code)) return bad(res);
  const updated = await User.findOneAndUpdate({ _id: user._id, sessionVersion: user.sessionVersion || 0 }, { $set: { mfaEnabled: false, mfaLastCounter: -1 }, $unset: { mfaSecret: 1, mfaRecoveryHashes: 1 }, $inc: { sessionVersion: 1 } }, { new: true }).select("+sessionVersion");
  if (!updated) return bad(res);
  setSession(res, updated); res.json({ enabled: false });
}));
module.exports = router;
module.exports.consumeFactor = consumeFactor;
