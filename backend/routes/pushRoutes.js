const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const Subscription = require("../models/PushSubscription");
const { configured, validEndpoint } = require("../utils/push");
router.use("/push", requireAuth);
router.get("/push/config", (req, res) => res.json({ enabled: configured(), publicKey: configured() ? process.env.VAPID_PUBLIC_KEY : null }));
router.post("/push/status", asyncHandler(async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== "string" || !validEndpoint(endpoint)) return res.status(400).json({ message: "Invalid subscription" });
  const user = await require("../models/User").findById(req.user.userId).select("+sessionVersion").lean();
  const active = configured() && Boolean(await Subscription.exists({ endpoint, userId: req.user.userId, sessionVersion: user.sessionVersion || 0 }));
  res.json({ enabled: active });
}));
router.post("/push/subscribe", asyncHandler(async (req, res) => {
  if (!configured()) return res.status(503).json({ message: "Browser notifications are not configured on this server yet." });
  const { endpoint, keys } = req.body || {};
  if (typeof endpoint !== "string" || !validEndpoint(endpoint) || !keys || typeof keys.auth !== "string" || typeof keys.p256dh !== "string" || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(keys.auth) || !/^[A-Za-z0-9_-]{87}={0,2}$/.test(keys.p256dh)) return res.status(400).json({ message: "Invalid push subscription" });
  const existing = await Subscription.findOne({ endpoint });
  if (existing && String(existing.userId) !== req.user.userId) return res.status(409).json({ message: "Disable notifications on this browser's previous account before enabling them here." });
  if (!existing && await Subscription.countDocuments({ userId: req.user.userId }) >= 10) return res.status(400).json({ message: "Notification device limit reached." });
  const user = await require("../models/User").findById(req.user.userId).select("sessionVersion").lean();
  // Include ownership in the atomic write: a concurrent subscription must
  // never transfer another account's endpoint after the preliminary read.
  await Subscription.findOneAndUpdate({ endpoint, userId: req.user.userId }, { $set: { endpoint, keys: { auth: keys.auth, p256dh: keys.p256dh }, sessionVersion: user.sessionVersion || 0 } }, { upsert: true });
  res.sendStatus(204);
}));
router.post("/push/unsubscribe", asyncHandler(async (req, res) => {
  if (typeof req.body?.endpoint !== "string") return res.status(400).json({ message: "Invalid subscription" });
  await Subscription.deleteOne({ endpoint: req.body.endpoint, userId: req.user.userId }); res.sendStatus(204);
}));
module.exports = router;
