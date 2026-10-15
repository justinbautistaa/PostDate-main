const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { asyncHandler } = require("../middleware/errorHandler");
const { createReport, createAppeal } = require("../controllers/safetyController");

const router = express.Router();

// Mounted at /api in server.js, so these become:
//   POST /api/reports   a signed-in member reports a profile / post / comment / message
//   POST /api/appeals   a suspended member appeals (email + password in the body)
//
// Appeals get the tight authLimiter because they check a password, exactly
// like log-in does. Reports ride on the general /api limiter from server.js.
router.post("/reports", requireAuth, asyncHandler(createReport));
router.get("/reports/updates", requireAuth, asyncHandler(async (req, res) => {
  const rows = await require("../models/Report").find({ reporterId: req.user.userId, status: { $ne: "pending" }, $expr: { $gt: ["$updatedAt", { $ifNull: ["$memberSeenAt", new Date(0)] }] } }).select("status reason updatedAt").sort({ updatedAt: -1 }).limit(100).lean();
  res.json(rows.map(row => ({ id: String(row._id), status: row.status, reason: row.reason, updatedAt: row.updatedAt })));
}));
router.post("/reports/seen", requireAuth, asyncHandler(async (req, res) => {
  const items = req.body?.reports;
  if (!Array.isArray(items) || items.length > 100 || items.some(item => !item || !/^[a-f\d]{24}$/i.test(item.id) || typeof item.updatedAt !== "string" || !Number.isFinite(Date.parse(item.updatedAt)))) return res.status(400).json({ message: "Invalid reports" });
  const Report = require("../models/Report");
  if (items.length) await Report.bulkWrite(items.map(item => ({ updateOne: { filter: { _id: item.id, reporterId: req.user.userId, updatedAt: new Date(item.updatedAt) }, update: { $set: { memberSeenAt: new Date(item.updatedAt) } }, timestamps: false } })));
  res.sendStatus(204);
}));
router.get("/reports/mine", requireAuth, asyncHandler(async (req, res) => {
  const before = req.query.before;
  if (before && (typeof before !== "string" || !/^[a-f\d]{24}$/i.test(before))) return res.status(400).json({ message: "Invalid report page" });
  const filter = { reporterId: req.user.userId };
  if (req.query.ids !== undefined) {
    const ids = typeof req.query.ids === "string" ? req.query.ids.split(",") : [];
    if (!ids.length || ids.length > 100 || ids.some(id => !/^[a-f\d]{24}$/i.test(id))) return res.status(400).json({ message: "Invalid reports" });
    filter._id = { $in: ids };
  }
  if (before) filter._id = { $lt: before };
  const rows = await require("../models/Report").find(filter)
    .select("reason description targetType status createdAt updatedAt resolvedAt").sort({ _id: -1 }).limit(req.query.ids ? 100 : 21).lean();
  const page = req.query.ids ? rows : rows.slice(0, 20);
  // Internal moderation notes, staff identities and other people's reports
  // are deliberately excluded from this member-facing response.
  res.json({ reports: page.map(row => ({ id: String(row._id), reason: row.reason, description: row.description || "", targetType: row.targetType, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt, resolvedAt: row.resolvedAt })), nextCursor: !req.query.ids && rows.length > 20 ? String(page[page.length - 1]._id) : null });
}));
router.post("/appeals", authLimiter, asyncHandler(createAppeal));

module.exports = router;
