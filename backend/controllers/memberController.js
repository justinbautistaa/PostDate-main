const mongoose = require("mongoose");
const User = require("../models/User");
const Profile = require("../models/Profile");
const Swipe = require("../models/Swipe");
const Match = require("../models/Match");
const Rating = require("../models/Rating");
const { parseBirthdate, calculateAge } = require("./authController");
const { escapeRegex, isObjectIdString } = require("../utils/adminHelpers");

const GENDERS = ["female", "male", "nonbinary", "self-describe", "prefer-not-to-say"];
const GENDER_LABELS = { female: "Woman", male: "Man", nonbinary: "Non-binary", "self-describe": "Self-described", "prefer-not-to-say": "Prefer not to say" };

async function updateDetails(req, res) {
  const input = req.body || {};
  const fields = { displayName: 50, bio: 1000, gender: 50, birthdate: 10, city: 100, country: 100 };
  if (Object.keys(input).some((key) => !Object.hasOwn(fields, key)) ||
      Object.entries(input).some(([key, value]) => typeof value !== "string" || value.length > fields[key])) {
    return res.status(400).json({ message: "Invalid profile fields" });
  }
  const dateOfBirth = parseBirthdate(input.birthdate);
  if (!dateOfBirth || dateOfBirth > new Date() || calculateAge(dateOfBirth) < 18 || !GENDERS.includes(input.gender)) {
    return res.status(400).json({ message: "Use a valid birthdate (age 18 or older) and gender" });
  }
  const profile = await Profile.findOneAndUpdate({ userId: req.user.userId }, { $set: {
    profileName: (input.displayName || "").trim(), bio: (input.bio || "").trim(),
    gender: input.gender, dateOfBirth,
    "location.city": (input.city || "").trim(), "location.country": (input.country || "").trim(),
  } }, { new: true, runValidators: true });
  if (!profile) return res.status(404).json({ message: "Profile not found" });
  return res.json({ profile });
}

function ageBoundary(years) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date;
}

async function discover(req, res) {
  const { query = "", gender = "Any", minAge = "18", maxAge = "80", cursor } = req.query;
  if (typeof query !== "string" || query.length > 100 ||
      !["Any", ...Object.values(GENDER_LABELS), ...GENDERS].includes(gender) ||
      !/^\d{1,3}$/.test(minAge) || !/^\d{1,3}$/.test(maxAge) ||
      Number(minAge) < 18 || Number(maxAge) > 120 || Number(minAge) > Number(maxAge) ||
      (cursor && !isObjectIdString(cursor))) return res.status(400).json({ message: "Invalid discovery filters" });
  const me = new mongoose.Types.ObjectId(req.user.userId);
  const genderKey = GENDERS.includes(gender) ? gender : Object.keys(GENDER_LABELS).find((key) => GENDER_LABELS[key] === gender);
  const filter = { dateOfBirth: { $lte: ageBoundary(Number(minAge)), $gt: ageBoundary(Number(maxAge) + 1) }, userId: { $ne: me } };
  filter.discoverable = { $ne: false };
  if (genderKey) filter.gender = genderKey;
  if (cursor) filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  const rows = await Profile.aggregate([
    { $match: filter },
    { $lookup: { from: User.collection.name, localField: "userId", foreignField: "_id", as: "account" } },
    { $unwind: "$account" },
    { $match: { "account.role": "user", "account.isActive": true, "account.isVerified": true, "account.emailVerifiedAt": { $ne: null } } },
    ...(query.trim() ? [{ $match: { $or: [{ profileName: new RegExp(escapeRegex(query.trim()), "i") }, { "account.firstName": new RegExp(escapeRegex(query.trim()), "i") }] } }] : []),
    { $lookup: { from: Swipe.collection.name, let: { target: "$userId" }, pipeline: [
      { $match: { $expr: { $and: [{ $eq: ["$fromUserId", me] }, { $eq: ["$toUserId", "$$target"] }] } } }, { $limit: 1 },
    ], as: "vote" } },
    { $match: { "vote.0": { $exists: false } } },
    { $lookup: { from: Match.collection.name, let: { target: "$userId" }, pipeline: [
      { $match: { status: { $in: ["blocked", "unmatched"] }, $expr: { $or: [
        { $and: [{ $eq: ["$user1", me] }, { $eq: ["$user2", "$$target"] }] },
        { $and: [{ $eq: ["$user2", me] }, { $eq: ["$user1", "$$target"] }] },
      ] } } }, { $limit: 1 },
    ], as: "endedMatch" } },
    { $match: { "endedMatch.0": { $exists: false } } },
    { $sort: { _id: -1 } }, { $limit: 25 },
    { $project: { _id: 1, userId: 1, profileName: 1, dateOfBirth: 1, gender: 1, bio: 1, avatar: 1, "account.firstName": 1 } },
  ]).option({ maxTimeMS: 5000, allowDiskUse: false });
  const more = rows.length > 24;
  const visible = rows.slice(0, 24);
  return res.json({
    profiles: visible.map((profile) => ({
      id: String(profile.userId), name: profile.profileName || profile.account.firstName,
      age: calculateAge(profile.dateOfBirth), gender: GENDER_LABELS[profile.gender] || profile.gender,
      photoPath: profile.avatar || null, bio: profile.bio || "",
    })).filter((profile) => profile.age >= Number(minAge) && profile.age <= Number(maxAge)),
    nextCursor: more ? String(visible[visible.length - 1]._id) : null,
  });
}

async function recordSwipe(req, res, action) {
  const rawId = req.body?.profileId;
  const id = typeof rawId === "string" ? rawId.toLowerCase() : rawId;
  if (!isObjectIdString(id) || id === req.user.userId) return res.status(400).json({ message: "Invalid profile" });
  if (await Match.exists({ status: { $in: ["blocked", "unmatched"] }, $or: [
    { user1: req.user.userId, user2: id }, { user2: req.user.userId, user1: id },
  ] })) return res.status(404).json({ message: "Profile unavailable" });
  const target = await User.exists({ _id: id, role: "user", isActive: true, isVerified: true, emailVerifiedAt: { $ne: null } });
  if (!target || !await Profile.exists({ userId: id, discoverable: { $ne: false } })) return res.status(404).json({ message: "Profile unavailable" });
  // First decision wins, including retries and concurrent button presses.
  let vote;
  try { vote = await Swipe.findOneAndUpdate({ fromUserId: req.user.userId, toUserId: id }, { $setOnInsert: { action } }, { upsert: true, new: true }); }
  catch (err) {
    if (err.code !== 11000) throw err;
    vote = await Swipe.findOne({ fromUserId: req.user.userId, toUserId: id });
  }
  require("../utils/chatEvents").emit(req.user.userId);
  if (vote.action === "like") require("../utils/chatEvents").emit(id);
  if (vote.action !== "like" || !await Swipe.exists({ fromUserId: id, toUserId: req.user.userId, action: "like" })) return res.json({ ok: true, matched: false });
  const [user1, user2] = [req.user.userId, id].sort();
  const pairKey = `${user1}:${user2}`;
  const existing = await Match.findOne({ $or: [{ user1, user2 }, { user1: user2, user2: user1 }] });
  if (existing) return res.json({ ok: true, matched: existing.status === "active", ...(existing.status === "active" ? { matchId: String(existing._id) } : {}) });
  try { await Match.create({ user1, user2, pairKey }); }
  catch (err) { if (err.code !== 11000) throw err; }
  require("../utils/chatEvents").emit(id);
  require("../utils/chatEvents").emit(req.user.userId);
  const match = await Match.findOne({ pairKey });
  return res.json({ ok: true, matched: true, matchId: String(match._id) });
}

async function discoverProfile(req, res) {
  const id = req.params.id;
  const unavailable = () => res.status(404).json({ message: "This profile is no longer available." });
  if (!isObjectIdString(id) || id.toLowerCase() === req.user.userId) return unavailable();
  const pair = { $or: [{ user1: req.user.userId, user2: id }, { user1: id, user2: req.user.userId }] };
  if (await Match.exists({ ...pair, status: { $in: ["blocked", "unmatched"] } }) ||
      await Swipe.exists({ fromUserId: req.user.userId, toUserId: id, action: "pass" })) return unavailable();
  const [user, profile] = await Promise.all([
    User.findOne({ _id: id, role: "user", isActive: true, isVerified: true, emailVerifiedAt: { $ne: null }, deletionRequestedAt: null }).select("firstName").lean(),
    Profile.findOne({ userId: id, discoverable: { $ne: false } }).select("profileName dateOfBirth gender avatar bio").lean(),
  ]);
  if (!user || !profile || calculateAge(profile.dateOfBirth) < 18) return unavailable();
  return res.json({ id: String(user._id), name: profile.profileName || user.firstName, age: calculateAge(profile.dateOfBirth), gender: GENDER_LABELS[profile.gender] || profile.gender, photoPath: profile.avatar || null, bio: profile.bio || "" });
}

async function matchHistory(req, res) {
  const { cursor, limit = "8" } = req.query;
  if ((cursor && !isObjectIdString(cursor)) || !/^\d{1,2}$/.test(limit) || Number(limit) < 1 || Number(limit) > 20) {
    return res.status(400).json({ message: "Invalid match page" });
  }
  const meId = req.user.userId;
  const filter = { $or: [{ user1: meId }, { user2: meId }], status: "active" };
  if (cursor) filter._id = { $lt: cursor };
  const rows = await Match.find(filter).sort({ _id: -1 }).limit(Number(limit) + 1).lean();
  const more = rows.length > Number(limit);
  const page = rows.slice(0, Number(limit));
  const ids = page.map((match) => String(match.user1) === meId ? match.user2 : match.user1);
  const [profiles, users, reviews, ownProfile, ownUser] = await Promise.all([
    Profile.find({ userId: { $in: ids } }).select("userId profileName avatar").lean(),
    User.find({ _id: { $in: ids }, isActive: true }).select("firstName").lean(),
    Rating.find({ reviewerId: meId, reviewedUserId: { $in: ids } }).select("reviewedUserId").lean(),
    Profile.findOne({ userId: meId }).select("profileName avatar").lean(),
    User.findById(meId).select("firstName").lean(),
  ]);
  const profileMap = new Map(profiles.map((profile) => [String(profile.userId), profile]));
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const reviewed = new Set(reviews.map((rating) => String(rating.reviewedUserId)));
  return res.json({
    me: { name: ownProfile?.profileName || ownUser?.firstName || "You", avatarPath: ownProfile?.avatar || null },
    matches: page.map((match) => {
      const id = String(match.user1) === meId ? String(match.user2) : String(match.user1);
      const available = userMap.has(id);
      const profile = profileMap.get(id);
      return { id: String(match._id), matchedAt: match.createdAt, reviewed: reviewed.has(id), partner: {
        id, name: available ? profile?.profileName || userMap.get(id).firstName : "Unavailable account", avatarPath: available ? profile?.avatar || null : null,
      } };
    }),
    nextCursor: more ? String(page[page.length - 1]._id) : null,
  });
}

module.exports = { updateDetails, discover, discoverProfile, recordSwipe, matchHistory, GENDERS };
