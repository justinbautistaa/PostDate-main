const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Message = require("../models/Message");
const Report = require("../models/Report");
const Appeal = require("../models/Appeal");
const { isValidEmail, isNonEmptyString } = require("../utils/validators");
const { asString, isObjectIdString } = require("../utils/adminHelpers");

/**
 * safetyController
 * The two ways data gets INTO the moderation queues:
 *   - a signed-in member reports a profile / post / comment / message
 *   - a suspended member appeals (they can't log in, so that route checks
 *     their email + password itself)
 * Staff then work through both from the dashboard — see adminController.js.
 */

// 🎛️ The reasons a member can pick from. Keep the frontend's report form (when
// it exists) in step with this list; the dashboard just displays whatever
// string was stored.
const REPORT_REASONS = [
  "Fake profile",
  "Harassment",
  "Inappropriate photos",
  "Spam or scam",
  "Underage",
  "Threats or violence",
  "Other",
];

const MIN_APPEAL_LENGTH = 10; // keep in step with minlength on models/Appeal.js
const MAX_APPEAL_LENGTH = 1000;

/**
 * Works out whose account a report is really about.
 * Returns the owner's id, or null if the target doesn't exist (or, for a
 * message, isn't one the reporter was part of — they shouldn't be able to
 * probe other people's conversations by filing reports against them).
 */
async function findReportedUserId(targetType, targetId, reporterId) {
  if (targetType === "user") {
    const user = await User.findById(targetId).select("_id");
    return user ? user._id : null;
  }
  if (targetType === "post") {
    const post = await Post.findById(targetId).select("userId");
    return post ? post.userId : null;
  }
  if (targetType === "comment") {
    const comment = await Comment.findById(targetId).select("userId");
    return comment ? comment.userId : null;
  }
  if (targetType === "message") {
    const message = await Message.findById(targetId).select("senderId receiverId");
    const involved =
      message && [String(message.senderId), String(message.receiverId)].includes(String(reporterId));
    return involved ? message.senderId : null;
  }
  return null;
}

/**
 * POST /api/reports   (requireAuth)
 * { targetType, targetId, reason, description? }
 */
async function createReport(req, res) {
  const { targetType, targetId, reason, description } = req.body ?? {};

  if (!["user", "post", "comment", "message"].includes(targetType)) {
    return res.status(400).json({ message: "Choose what you're reporting" });
  }
  if (!isObjectIdString(targetId)) {
    return res.status(400).json({ message: "Invalid target" });
  }
  if (!REPORT_REASONS.includes(reason)) {
    return res.status(400).json({ message: "Choose a reason from the list" });
  }
  const details = asString(description, 2000).trim();

  const reportedUserId = await findReportedUserId(targetType, targetId, req.user.userId);
  if (!reportedUserId) {
    return res.status(404).json({ message: "We couldn't find what you're trying to report" });
  }
  if (String(reportedUserId) === req.user.userId) {
    return res.status(400).json({ message: "You can't report yourself" });
  }

  const duplicate = await Report.exists({
    reporterId: req.user.userId,
    targetType,
    targetId,
    status: "pending",
  });
  if (duplicate) {
    return res.status(409).json({ message: "You've already reported this. We're looking at it." });
  }

  const report = await Report.create({
    reporterId: req.user.userId,
    targetType,
    targetId,
    reportedUserId,
    reason,
    description: details,
  });
  res.status(201).json({ id: report._id });
}

/**
 * POST /api/appeals   (no token — the person is suspended)
 * { email, password, message }
 *
 * Same discipline as log-in: a wrong email and a wrong password get the very
 * same 401, so this can't be used to find out which emails have accounts.
 * Mounted behind authLimiter (see routes/safetyRoutes.js).
 */
async function createAppeal(req, res) {
  const { email, password, message } = req.body ?? {};
  if (!isValidEmail(email) || !isNonEmptyString(password) || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  const text = asString(message, MAX_APPEAL_LENGTH).trim();
  if (text.length < MIN_APPEAL_LENGTH) {
    return res.status(400).json({ message: `Tell us what happened (at least ${MIN_APPEAL_LENGTH} characters)` });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Wrong email or password" });
  }
  if (user.isActive) {
    return res.status(400).json({ message: "This account isn't suspended" });
  }

  const open = await Appeal.exists({ userId: user._id, status: "pending" });
  if (open) {
    return res.status(409).json({ message: "You already have an appeal waiting for review" });
  }

  const appeal = await Appeal.create({ userId: user._id, message: text });
  res.status(201).json({ id: appeal._id });
}

module.exports = { createReport, createAppeal, REPORT_REASONS };
