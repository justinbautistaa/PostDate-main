const express = require("express");
const Entry = require("../models/WorkspaceEntry");
const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const router = express.Router();
const noticeEvents = new (require("events").EventEmitter)();
noticeEvents.setMaxListeners(0);
const team = requireRole("admin", "moderator");
const validId = value => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const serialize = row => ({ id: row.id, title: row.title, body: row.body, audience: row.audience, when: row.when, done: row.done, createdAt: row.createdAt, author: row.owner?.firstName ? `${row.owner.firstName} ${row.owner.lastName}` : undefined, member: row.member ? { id: row.member.id, name: `${row.member.firstName} ${row.member.lastName}` } : null });
function content(body) {
  if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 120 || (body.body !== undefined && (typeof body.body !== "string" || body.body.length > 2000))) return null;
  return { title: body.title.trim(), body: (body.body || "").trim() };
}
router.use("/workspace", requireAuth);
router.get("/workspace/announcements/live", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  // Only an invalidation signal is streamed. The authenticated list request
  // always rechecks the current role, suspension, session and audience.
  const changed = () => res.write("event: notices\ndata: {}\n\n");
  noticeEvents.on("changed", changed);
  changed();
  // Reconcile across server instances and recover missed publish events.
  const timer = setInterval(changed, 15000);
  const expiry = setTimeout(() => res.end(), 5 * 60 * 1000);
  req.on("close", () => { clearInterval(timer); clearTimeout(expiry); noticeEvents.off("changed", changed); });
});
router.get("/workspace/announcements", asyncHandler(async (req, res) => {
  const audience = req.user.role === "user" ? "members" : "staff";
  const filter = req.user.role === "admin" ? {} : { audience: { $in: ["everyone", audience] } };
  const rows = await Entry.find({ kind: "announcement", ...filter }).sort({ createdAt: -1 }).limit(50);
  res.json(rows.map(serialize));
}));
router.post("/workspace/announcements", requireRole("admin"), asyncHandler(async (req, res) => {
  const data = content(req.body);
  if (!data || !["everyone", "members", "staff"].includes(req.body.audience)) return res.status(400).json({ message: "Enter a title, message up to 2,000 characters, and a valid audience." });
  const row = await Entry.create({ ...data, kind: "announcement", owner: req.user.userId, audience: req.body.audience });
  noticeEvents.emit("changed");
  res.status(201).json(serialize(row));
}));
router.get("/workspace/notes", team, asyncHandler(async (req, res) => {
  const rows = await Entry.find({ kind: "note" }).populate("member", "firstName lastName").populate("owner", "firstName lastName").sort({ createdAt: -1 }).limit(100);
  res.json(rows.map(serialize));
}));
router.post("/workspace/notes", team, asyncHandler(async (req, res) => {
  const data = content(req.body);
  if (!data || !validId(req.body.member)) return res.status(400).json({ message: "Choose a member and enter a title and note up to 2,000 characters." });
  const member = await User.findOne({ _id: req.body.member, role: "user" });
  if (!member) return res.status(404).json({ message: "Member not found." });
  const row = await Entry.create({ ...data, kind: "note", member: member._id, owner: req.user.userId });
  await row.populate("member", "firstName lastName");
  await row.populate("owner", "firstName lastName");
  res.status(201).json(serialize(row));
}));
router.get("/workspace/plans", asyncHandler(async (req, res) => {
  const rows = await Entry.find({ kind: "plan", owner: req.user.userId }).sort({ createdAt: -1 }).limit(100);
  res.json(rows.map(serialize));
}));
router.post("/workspace/plans", asyncHandler(async (req, res) => {
  const data = content(req.body);
  const when = typeof req.body.when === "string" ? new Date(req.body.when) : null;
  if (!data || !when || !Number.isFinite(when.getTime()) || when <= new Date()) return res.status(400).json({ message: "Enter a title, details up to 2,000 characters, and a future date and time." });
  const row = await Entry.create({ ...data, kind: "plan", owner: req.user.userId, when });
  res.status(201).json(serialize(row));
}));
// Every mutation checks both the entry kind and the current user's permissions.
router.patch("/workspace/:id", asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid update." });
  const row = await Entry.findById(req.params.id);
  if (!row || (row.kind === "plan" ? String(row.owner) !== req.user.userId : row.kind !== "note" || !["admin", "moderator"].includes(req.user.role))) return res.status(404).json({ message: "Entry not found." });
  if (typeof req.body.done === "boolean") row.done = req.body.done;
  else if (row.kind === "plan") {
    const data = content(req.body);
    const when = typeof req.body.when === "string" ? new Date(req.body.when) : null;
    if (!data || !when || !Number.isFinite(when.getTime()) || when <= new Date()) return res.status(400).json({ message: "Enter a title, details up to 2,000 characters, and a future date and time." });
    Object.assign(row, data, { when });
  } else return res.status(400).json({ message: "Invalid update." });
  await row.save(); await row.populate("member", "firstName lastName");
  if (row.kind === "note") await row.populate("owner", "firstName lastName");
  res.json(serialize(row));
}));
router.delete("/workspace/:id", asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid entry." });
  const row = await Entry.findById(req.params.id);
  if (!row || (row.kind === "announcement" ? req.user.role !== "admin" : row.kind === "plan" ? String(row.owner) !== req.user.userId : req.user.role !== "admin" && (req.user.role !== "moderator" || String(row.owner) !== req.user.userId))) return res.status(404).json({ message: "Entry not found." });
  await row.deleteOne();
  if (row.kind === "announcement") noticeEvents.emit("changed");
  res.sendStatus(204);
}));
module.exports = router;
