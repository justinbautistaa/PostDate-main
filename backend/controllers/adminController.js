const User = require("../models/User");
const Profile = require("../models/Profile");
const Rating = require("../models/Rating");
const Report = require("../models/Report");
const Appeal = require("../models/Appeal");
const AuditLog = require("../models/AuditLog");
const {
  escapeRegex,
  asString,
  isObjectIdString,
  parsePage,
  pageInfo,
  seriesStart,
  buildDaySeries,
  maskEmail,
  fullName,
  clip,
} = require("../utils/adminHelpers");
const stats = require("../utils/adminStats");

/**
 * adminController
 * Everything behind the staff dashboard. routes/adminRoutes.js puts
 * requireAuth + requireRole("admin", "moderator") in front of all of it, so a
 * handler here can assume req.user is a logged-in staff member. Admin-only
 * handlers (role changes, the activity log) are additionally gated by
 * requireRole("admin") on their route.
 *
 * Rules every handler follows:
 *   - The SERVER decides what a person may do. Each list row carries a `can`
 *     block so the UI can hide buttons, but the same check runs again when
 *     the action actually arrives (see canModerate).
 *   - Every state change writes an AuditLog entry — see audit().
 *   - Nothing from the query string reaches Mongo unless it has been
 *     reduced to a plain string or matched against an allow-list first.
 */

const ROLES = ["user", "moderator", "admin"];
const REPORT_STATUSES = stats.REPORT_STATUSES;
const REPORT_TARGETS = ["user", "post", "comment", "message"];
const APPEAL_STATUSES = ["pending", "approved", "denied"];

const MIN_REASON = 3; // 🎛️ shortest reason / note staff may give when one is required
const MAX_NOTE = 500; // 🎛️ keep in sync with the maxlength on the models

/* ─────────────────────────────────────────────────────────────────────────
   Shared helpers
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Can `actor` (req.user) take a moderation action on `target` (a User)?
 *   - never on yourself
 *   - admins: on anyone else
 *   - moderators: only on ordinary members, never on other staff
 */
function canModerate(actor, target) {
  if (String(target._id) === actor.userId) {
    return { ok: false, message: "You can't do that to your own account" };
  }
  if (actor.role === "admin") return { ok: true, message: "" };
  if (actor.role === "moderator" && target.role === "user") return { ok: true, message: "" };
  return { ok: false, message: "Only admins can act on staff accounts" };
}

/** Writes one audit row. Best effort: a logging hiccup must not undo a finished action. */
async function audit(req, { action, targetType, targetId, summary, details }) {
  try {
    await AuditLog.create({
      actorId: req.user.userId,
      actorRole: req.user.role,
      action,
      targetType,
      targetId,
      summary: clip(summary, 380),
      details,
    });
  } catch (err) {
    console.error("[audit] write failed");
  }
}

/** Loads { _id -> user } for a set of ids, in one query. */
async function loadPeople(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } })
    .select("firstName lastName email role isActive suspendedAt suspensionReason suspendedBy")
    .lean();
  return new Map(users.map((u) => [String(u._id), u]));
}

/** The small "who" object every row carries. */
function person(people, id) {
  if (!id) return null;
  const u = people.get(String(id));
  if (!u) return { id: String(id), name: "Deleted account", role: null, status: "deleted" };
  return {
    id: String(u._id),
    name: fullName(u),
    role: u.role,
    status: u.isActive === false ? "suspended" : "active",
  };
}

/** Matches "ada", "lovelace" or "ada lovelace" against a member's name. */
function nameMatch(text) {
  return {
    $expr: {
      $regexMatch: {
        input: { $concat: ["$firstName", " ", "$lastName"] },
        regex: escapeRegex(text),
        options: "i",
      },
    },
  };
}

/** Required free-text field (a reason or note). Returns { value } or { error }. */
function requiredText(raw, label) {
  const value = asString(raw, MAX_NOTE).trim();
  if (value.length < MIN_REASON) {
    return { error: `${label} needs at least ${MIN_REASON} characters` };
  }
  return { value };
}

/** Validates :id, loads that User, and checks the actor may act on them. Sends the error itself. */
async function loadModerationTarget(req, res) {
  if (!isObjectIdString(req.params.id)) {
    res.status(400).json({ message: "Invalid user id" });
    return null;
  }
  const target = await User.findById(req.params.id).select("_id role isActive firstName lastName");
  if (!target) {
    res.status(404).json({ message: "User not found" });
    return null;
  }
  const check = canModerate(req.user, target);
  if (!check.ok) {
    res.status(403).json({ message: check.message });
    return null;
  }
  return target;
}

/** Puts a suspended account back and closes any appeal still waiting on it. */
async function reinstateAccount(userId, actorId, note) {
  const user = await User.findOneAndUpdate(
    { _id: userId, isActive: false },
    { $set: { isActive: true, suspendedAt: null, suspensionReason: "", suspendedBy: null } },
    { new: true }
  );
  if (user) {
    await Appeal.updateMany(
      { userId, status: "pending" },
      { $set: { status: "approved", decidedBy: actorId, decidedAt: new Date(), decisionNote: note } }
    );
  }
  return user;
}

/* ─────────────────────────────────────────────────────────────────────────
   Overview + statistics
   ───────────────────────────────────────────────────────────────────────── */

/** GET /api/admin/overview — header counter and sidebar badges. */
async function getOverview(req, res) {
  res.json(await stats.getOverview());
}

/** GET /api/admin/statistics?days=7|14|30|90 */
async function getStatistics(req, res) {
  const requested = typeof req.query.days === 'string' && /^\d+$/.test(req.query.days) ? Number(req.query.days) : NaN;
  const days = stats.RANGE_OPTIONS.includes(requested) ? requested : 30;
  res.json(await stats.getStatistics(days));
}

/* ─────────────────────────────────────────────────────────────────────────
   Users
   ───────────────────────────────────────────────────────────────────────── */

/**
 * GET /api/admin/users?q=&status=all|active|suspended|unverified&role=&page=
 * Moderators see masked emails and can search by name only — typing an
 * address into the box would otherwise confirm whether it has an account.
 */
async function listUsers(req, res) {
  const paging = parsePage(req.query, { defaultLimit: 12 });
  const isAdmin = req.user.role === "admin";
  const q = asString(req.query.q, 100).trim();
  const status = ["active", "suspended", "unverified"].includes(req.query.status)
    ? req.query.status
    : "all";
  const role = ROLES.includes(req.query.role) ? req.query.role : null;

  const filter = {};
  if (status === "active") filter.isActive = true;
  if (status === "suspended") filter.isActive = false;
  if (status === "unverified") filter.isVerified = false;
  if (role) filter.role = role;
  if (isAdmin && req.query.team === "true" && !role) filter.role = { $in: ["admin", "moderator"] };
  if (!isAdmin) filter.role = "user";
  if (q) {
    filter.$or = [nameMatch(q)];
    if (isAdmin) filter.$or.push({ email: new RegExp(escapeRegex(q), "i") });
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .lean(),
  ]);

  const ids = users.map((u) => u._id);
  const [profiles, ratingRows, reportRows] = await Promise.all([
    Profile.find({ userId: { $in: ids } }).select("userId avatar").lean(),
    Rating.aggregate([
      { $match: { reviewedUserId: { $in: ids }, isHidden: { $ne: true } } },
      { $group: { _id: "$reviewedUserId", average: { $avg: "$ratings.overall" }, count: { $sum: 1 } } },
    ]),
    Report.aggregate([
      { $match: { reportedUserId: { $in: ids } } },
      {
        $group: {
          _id: "$reportedUserId",
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const avatars = new Map(profiles.map((p) => [String(p.userId), p.avatar]));
  const ratingBy = new Map(
    ratingRows.map((r) => [String(r._id), { average: Math.round(r.average * 10) / 10, count: r.count }])
  );
  const reportBy = new Map(reportRows.map((r) => [String(r._id), { total: r.total, open: r.open }]));

  const rows = users.map((u) => {
    const id = String(u._id);
    const isSelf = id === req.user.userId;
    const check = canModerate(req.user, u);
    const suspended = u.isActive === false;
    return {
      id,
      name: fullName(u),
      email: isAdmin ? u.email : maskEmail(u.email),
      isDemo: /@demo\.postdate\.test$/i.test(u.email || ""),
      role: u.role,
      status: suspended ? "suspended" : "active",
      verified: Boolean(u.isVerified),
      isSelf,
      joinedAt: u.createdAt,
      lastActiveAt: u.lastActiveAt ?? null,
      avatar: avatars.get(id) ?? null,
      rating: ratingBy.get(id) ?? { average: null, count: 0 },
      reports: reportBy.get(id) ?? { total: 0, open: 0 },
      suspension: suspended ? { reason: u.suspensionReason || "", at: u.suspendedAt ?? null } : null,
      can: { suspend: check.ok, changeRole: isAdmin && !isSelf, note: check.ok ? "" : check.message },
    };
  });

  res.json({ rows, ...pageInfo(total, paging) });
}

/** POST /api/admin/users/:id/suspend  { reason } */
async function suspendUser(req, res) {
  const target = await loadModerationTarget(req, res);
  if (!target) return;

  const reason = requiredText(req.body?.reason, "A reason");
  if (reason.error) return res.status(400).json({ message: reason.error });

  // The isActive: true condition makes this atomic — two staff clicking
  // Suspend at once can't both "win".
  const updated = await User.findOneAndUpdate(
    { _id: target._id, isActive: true },
    {
      $inc: { sessionVersion: 1 },
      $set: {
        isActive: false,
        suspendedAt: new Date(),
        suspensionReason: reason.value,
        suspendedBy: req.user.userId,
      },
    },
    { new: true }
  );
  if (!updated) return res.status(409).json({ message: "That account is already suspended" });

  await audit(req, {
    action: "user.suspend",
    targetType: "user",
    targetId: target._id,
    summary: `Suspended ${fullName(target)}: ${clip(reason.value)}`,
    details: { reason: reason.value },
  });
  res.json({ ok: true, status: "suspended" });
}

/** POST /api/admin/users/:id/reinstate */
async function reinstateUser(req, res) {
  const target = await loadModerationTarget(req, res);
  if (!target) return;

  const updated = await reinstateAccount(target._id, req.user.userId, "Account was reinstated directly.");
  if (!updated) return res.status(409).json({ message: "That account isn't suspended" });

  await audit(req, {
    action: "user.reinstate",
    targetType: "user",
    targetId: target._id,
    summary: `Reinstated ${fullName(target)}`,
  });
  res.json({ ok: true, status: "active" });
}

/** PATCH /api/admin/users/:id/role  { role }   (admins only — see the route) */
async function setUserRole(req, res) {
  if (!isObjectIdString(req.params.id)) return res.status(400).json({ message: "Invalid user id" });
  const role = req.body?.role;
  if (!ROLES.includes(role)) return res.status(400).json({ message: "Role must be user, moderator or admin" });

  if (req.params.id.toLowerCase() === req.user.userId.toLowerCase()) {
    return res.status(403).json({ message: "You can't change your own role" });
  }
  const target = await User.findById(req.params.id).select("_id role firstName lastName");
  if (!target) return res.status(404).json({ message: "User not found" });
  if (target.role === role) return res.json({ ok: true, role });

  const previous = target.role;
  await User.updateOne({ _id: target._id }, { $set: { role } });

  await audit(req, {
    action: "user.role_change",
    targetType: "user",
    targetId: target._id,
    summary: `Changed ${fullName(target)} from ${previous} to ${role}`,
    details: { from: previous, to: role },
  });
  res.json({ ok: true, role });
}

/* ─────────────────────────────────────────────────────────────────────────
   Reports
   ───────────────────────────────────────────────────────────────────────── */

/** GET /api/admin/reports?status=pending|reviewed|resolved|dismissed|all&type=&page= */
async function listReports(req, res) {
  const paging = parsePage(req.query, { defaultLimit: 10 });
  const status = REPORT_STATUSES.includes(req.query.status) ? req.query.status : null;
  const type = REPORT_TARGETS.includes(req.query.type) ? req.query.type : null;

  const filter = {};
  if (status) filter.status = status;
  if (type) filter.targetType = type;

  const [total, reports, countRows] = await Promise.all([
    Report.countDocuments(filter),
    Report.find(filter).sort({ createdAt: -1, _id: -1 }).skip(paging.skip).limit(paging.limit).lean(),
    Report.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const counts = Object.fromEntries(REPORT_STATUSES.map((s) => [s, 0]));
  countRows.forEach((r) => {
    if (r._id in counts) counts[r._id] = r.count;
  });
  counts.all = REPORT_STATUSES.reduce((sum, s) => sum + counts[s], 0);

  const people = await loadPeople(
    reports.flatMap((r) => [r.reporterId, r.reportedUserId, r.resolvedBy])
  );

  const rows = reports.map((r) => {
    const reported = r.reportedUserId ? people.get(String(r.reportedUserId)) : null;
    const canSuspend =
      Boolean(reported) && reported.isActive !== false && canModerate(req.user, reported).ok;
    return {
      id: String(r._id),
      targetType: r.targetType,
      targetId: String(r.targetId),
      reason: r.reason,
      description: r.description || "",
      status: r.status,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt ?? null,
      note: r.resolutionNote || "",
      reporter: person(people, r.reporterId),
      reportedUser: person(people, r.reportedUserId),
      handledBy: person(people, r.resolvedBy),
      can: { suspendReported: canSuspend },
    };
  });

  res.json({ rows, counts, ...pageInfo(total, paging) });
}

/** PATCH /api/admin/reports/:id  { status, note? } */
async function updateReport(req, res) {
  if (!isObjectIdString(req.params.id)) return res.status(400).json({ message: "Invalid report id" });
  const status = req.body?.status;
  if (!REPORT_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Status must be pending, reviewed, resolved or dismissed" });
  }
  const note = asString(req.body?.note, MAX_NOTE).trim();

  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  if (report.status === status && report.resolutionNote === note) return res.json({ ok: true, status });

  const previous = report.status;
  const closing = status === "resolved" || status === "dismissed";
  report.status = status;
  report.resolutionNote = status === "pending" ? "" : note;
  report.resolvedBy = status === "pending" ? null : req.user.userId;
  report.resolvedAt = closing ? new Date() : null;
  await report.save();
  require("../utils/chatEvents").emit(String(report.reporterId));
  require("../utils/push").sendPush(report.reporterId, { title: "Your PostDate report was updated", url: "/my-reports" }).catch(() => {});

  await audit(req, {
    action: "report.update",
    targetType: "report",
    targetId: report._id,
    summary: `Moved a report (${report.reason}) from ${previous} to ${status}${note ? `: ${clip(note)}` : ""}`,
    details: { from: previous, to: status, note },
  });
  res.json({ ok: true, status });
}

/* ─────────────────────────────────────────────────────────────────────────
   Ratings
   ───────────────────────────────────────────────────────────────────────── */

/**
 * GET /api/admin/ratings?visibility=all|visible|hidden|low&q=&page=
 * `summary` always covers every visible rating, whatever the filter is.
 */
async function listRatings(req, res) {
  const paging = parsePage(req.query, { defaultLimit: 10 });
  const visibility = ["visible", "hidden", "low"].includes(req.query.visibility)
    ? req.query.visibility
    : "all";
  const q = asString(req.query.q, 100).trim();

  const filter = {};
  if (visibility === "visible") filter.isHidden = { $ne: true };
  if (visibility === "hidden") filter.isHidden = true;
  if (visibility === "low") filter["ratings.overall"] = { $lte: 2 };
  if (q) {
    const matched = await User.find(nameMatch(q)).select("_id").limit(100).lean();
    const ids = matched.map((u) => u._id);
    filter.$or = [
      { comment: new RegExp(escapeRegex(q), "i") },
      { reviewerId: { $in: ids } },
      { reviewedUserId: { $in: ids } },
    ];
  }

  const [total, ratings, summary, all, hidden, low] = await Promise.all([
    Rating.countDocuments(filter),
    Rating.find(filter).sort({ createdAt: -1, _id: -1 }).skip(paging.skip).limit(paging.limit).lean(),
    stats.ratingSummary(),
    Rating.countDocuments({}),
    Rating.countDocuments({ isHidden: true }),
    Rating.countDocuments({ "ratings.overall": { $lte: 2 } }),
  ]);

  const people = await loadPeople(
    ratings.flatMap((r) => [r.reviewerId, r.reviewedUserId, r.hiddenBy])
  );

  const rows = ratings.map((r) => ({
    id: String(r._id),
    reviewer: person(people, r.reviewerId),
    reviewed: person(people, r.reviewedUserId),
    scores: {
      overall: r.ratings.overall,
      spice: r.ratings.spice,
      attentiveness: r.ratings.attentiveness,
      respectfulness: r.ratings.respectfulness,
      chemistry: r.ratings.chemistry,
    },
    comment: r.comment || "",
    isHidden: Boolean(r.isHidden),
    hiddenReason: r.hiddenReason || "",
    hiddenAt: r.hiddenAt ?? null,
    hiddenBy: person(people, r.hiddenBy),
    createdAt: r.createdAt,
  }));

  res.json({
    rows,
    summary,
    counts: { all, visible: all - hidden, hidden, low },
    ...pageInfo(total, paging),
  });
}

/** PATCH /api/admin/ratings/:id  { hidden: boolean, reason? }  — a reason is required to hide. */
async function setRatingHidden(req, res) {
  if (!isObjectIdString(req.params.id)) return res.status(400).json({ message: "Invalid rating id" });
  if (typeof req.body?.hidden !== "boolean") {
    return res.status(400).json({ message: "Say whether to hide or restore it" });
  }
  const hide = req.body.hidden;

  const rating = await Rating.findById(req.params.id).select("reviewerId reviewedUserId isHidden");
  if (!rating) return res.status(404).json({ message: "Rating not found" });
  if (Boolean(rating.isHidden) === hide) {
    return res.status(409).json({ message: hide ? "That rating is already hidden" : "That rating isn't hidden" });
  }

  let reason = { value: "" };
  if (hide) {
    reason = requiredText(req.body?.reason, "A reason");
    if (reason.error) return res.status(400).json({ message: reason.error });
  }

  await Rating.updateOne(
    { _id: rating._id },
    hide
      ? { $set: { isHidden: true, hiddenReason: reason.value, hiddenBy: req.user.userId, hiddenAt: new Date() } }
      : { $set: { isHidden: false, hiddenReason: "", hiddenBy: null, hiddenAt: null } }
  );

  const people = await loadPeople([rating.reviewerId, rating.reviewedUserId]);
  const who = `${person(people, rating.reviewerId).name}'s rating of ${person(people, rating.reviewedUserId).name}`;
  await audit(req, {
    action: hide ? "rating.hide" : "rating.restore",
    targetType: "rating",
    targetId: rating._id,
    summary: hide ? `Hid ${who}: ${clip(reason.value)}` : `Restored ${who}`,
    details: hide ? { reason: reason.value } : undefined,
  });
  res.json({ ok: true, hidden: hide });
}

/* ─────────────────────────────────────────────────────────────────────────
   Appeals
   ───────────────────────────────────────────────────────────────────────── */

/** GET /api/admin/appeals?status=pending|approved|denied|all&page= */
async function listAppeals(req, res) {
  const paging = parsePage(req.query, { defaultLimit: 10 });
  const isAdmin = req.user.role === "admin";
  const status = APPEAL_STATUSES.includes(req.query.status) ? req.query.status : null;
  const filter = status ? { status } : {};

  const [total, appeals, countRows] = await Promise.all([
    Appeal.countDocuments(filter),
    Appeal.find(filter).sort({ createdAt: -1, _id: -1 }).skip(paging.skip).limit(paging.limit).lean(),
    Appeal.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const counts = Object.fromEntries(APPEAL_STATUSES.map((s) => [s, 0]));
  countRows.forEach((r) => {
    if (r._id in counts) counts[r._id] = r.count;
  });
  counts.all = APPEAL_STATUSES.reduce((sum, s) => sum + counts[s], 0);

  const people = await loadPeople(appeals.flatMap((a) => [a.userId, a.decidedBy]));
  // Who suspended each member, so the card can say so
  const suspenders = await loadPeople([...people.values()].map((u) => u.suspendedBy));

  const rows = appeals.map((a) => {
    const u = people.get(String(a.userId));
    const check = u ? canModerate(req.user, u) : { ok: false };
    return {
      id: String(a._id),
      message: a.message,
      status: a.status,
      createdAt: a.createdAt,
      decidedAt: a.decidedAt ?? null,
      decisionNote: a.decisionNote || "",
      decidedBy: person(people, a.decidedBy),
      user: u
        ? {
            id: String(u._id),
            name: fullName(u),
            email: isAdmin ? u.email : maskEmail(u.email),
            role: u.role,
            status: u.isActive === false ? "suspended" : "active",
            suspension:
              u.isActive === false
                ? {
                    reason: u.suspensionReason || "",
                    at: u.suspendedAt ?? null,
                    by: person(suspenders, u.suspendedBy),
                  }
                : null,
          }
        : { id: String(a.userId), name: "Deleted account", email: "", role: null, status: "deleted", suspension: null },
      can: { decide: a.status === "pending" && check.ok },
    };
  });

  res.json({ rows, counts, ...pageInfo(total, paging) });
}

/** POST /api/admin/appeals/:id/decision  { decision: "approve" | "deny", note? } — a note is required to deny. */
async function decideAppeal(req, res) {
  if (!isObjectIdString(req.params.id)) return res.status(400).json({ message: "Invalid appeal id" });
  const decision = req.body?.decision;
  if (decision !== "approve" && decision !== "deny") {
    return res.status(400).json({ message: "Decision must be approve or deny" });
  }

  const appeal = await Appeal.findById(req.params.id);
  if (!appeal) return res.status(404).json({ message: "Appeal not found" });
  if (appeal.status !== "pending") return res.status(409).json({ message: "That appeal has already been decided" });

  const member = await User.findById(appeal.userId).select("_id role isActive firstName lastName");
  if (!member) return res.status(404).json({ message: "That account no longer exists" });
  const check = canModerate(req.user, member);
  if (!check.ok) return res.status(403).json({ message: check.message });

  let note = { value: asString(req.body?.note, MAX_NOTE).trim() };
  if (decision === "deny") {
    note = requiredText(req.body?.note, "A reason for denying");
    if (note.error) return res.status(400).json({ message: note.error });
  }

  // Claim the appeal first (only one decision can win), then act on the account.
  const status = decision === "approve" ? "approved" : "denied";
  const claimed = await Appeal.findOneAndUpdate(
    { _id: appeal._id, status: "pending" },
    { $set: { status, decidedBy: req.user.userId, decidedAt: new Date(), decisionNote: note.value } },
    { new: true }
  );
  if (!claimed) return res.status(409).json({ message: "That appeal has already been decided" });

  if (decision === "approve") {
    await User.updateOne(
      { _id: member._id },
      { $set: { isActive: true, suspendedAt: null, suspensionReason: "", suspendedBy: null } }
    );
  }

  await audit(req, {
    action: decision === "approve" ? "appeal.approve" : "appeal.deny",
    targetType: "appeal",
    targetId: appeal._id,
    summary:
      decision === "approve"
        ? `Approved ${fullName(member)}'s appeal and reinstated them`
        : `Denied ${fullName(member)}'s appeal: ${clip(note.value)}`,
    details: { note: note.value },
  });
  res.json({ ok: true, status });
}

/* ─────────────────────────────────────────────────────────────────────────
   Mod activity (admins only)
   ───────────────────────────────────────────────────────────────────────── */

const ACTIVITY_DAYS = 14; // 🎛️ how far back the charts on the Mod activity page look

/** GET /api/admin/activity?action=&actor=&page= */
async function listActivity(req, res) {
  const paging = parsePage(req.query, { defaultLimit: 15 });
  const filter = {};
  if (AuditLog.AUDIT_ACTIONS.includes(req.query.action)) filter.action = req.query.action;
  if (isObjectIdString(req.query.actor)) filter.actorId = req.query.actor;

  const since = seriesStart(ACTIVITY_DAYS);
  const [total, entries, [summaryRows]] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip(paging.skip).limit(paging.limit).lean(),
    AuditLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $facet: {
          perDay: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
                count: { $sum: 1 },
              },
            },
          ],
          byActor: [{ $group: { _id: "$actorId", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 6 }],
          byAction: [{ $group: { _id: "$action", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        },
      },
    ]),
  ]);

  const people = await loadPeople([
    ...entries.map((e) => e.actorId),
    ...(summaryRows?.byActor ?? []).map((a) => a._id),
  ]);

  res.json({
    rows: entries.map((e) => ({
      id: String(e._id),
      at: e.createdAt,
      actor: { ...person(people, e.actorId), role: e.actorRole },
      action: e.action,
      summary: e.summary,
    })),
    summary: {
      days: ACTIVITY_DAYS,
      perDay: buildDaySeries(summaryRows?.perDay ?? [], ACTIVITY_DAYS),
      byActor: (summaryRows?.byActor ?? []).map((a) => ({ actor: person(people, a._id), count: a.count })),
      byAction: (summaryRows?.byAction ?? []).map((a) => ({ action: a._id, count: a.count })),
    },
    ...pageInfo(total, paging),
  });
}

module.exports = {
  canModerate,
  getOverview,
  getStatistics,
  listUsers,
  suspendUser,
  reinstateUser,
  setUserRole,
  listReports,
  updateReport,
  listRatings,
  setRatingHidden,
  listAppeals,
  decideAppeal,
  listActivity,
};
