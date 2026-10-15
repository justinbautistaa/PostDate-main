const router = require("express").Router();
const mongoose = require("mongoose");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { isObjectIdString } = require("../utils/adminHelpers");
const Match = require("../models/Match");
const Message = require("../models/Message");
const User = require("../models/User");
const Profile = require("../models/Profile");
const Rating = require("../models/Rating");
const chatEvents = require("../utils/chatEvents");

router.use("/chats", requireAuth);
router.get("/chats/blocked", asyncHandler(async (req, res) => {
  const rows = await Match.find({ blockedBy: req.user.userId }).sort({ updatedAt: -1 }).limit(100).lean();
  const ids = rows.map(row => String(row.user1) === req.user.userId ? row.user2 : row.user1);
  const users = await User.find({ _id: { $in: ids } }).select("firstName").lean();
  const names = new Map(users.map(user => [String(user._id), user.firstName]));
  res.json(rows.map(row => ({ id: String(row._id), name: names.get(String(row.user1) === req.user.userId ? String(row.user2) : String(row.user1)) || "Unavailable member" })));
}));
router.post("/chats/:id/unblock", asyncHandler(async (req, res) => {
  if (!isObjectIdString(req.params.id)) return res.status(400).json({ message: "Invalid match" });
  const row = await Match.findOneAndUpdate({ _id: req.params.id, blockedBy: req.user.userId }, { $pull: { blockedBy: req.user.userId } }, { new: true });
  if (!row) return res.status(404).json({ message: "Blocked person not found" });
  if (!row.blockedBy.length) await Match.updateOne({ _id: row._id, blockedBy: { $size: 0 }, status: "blocked" }, { $set: { status: "unmatched" } });
  // Unblocking never restores a conversation or overrides another block.
  res.sendStatus(204);
}));
router.get("/chats/live", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  const changed = () => res.write("event: messages\ndata: {}\n\n");
  chatEvents.on(req.user.userId, changed);
  changed();
  const timer = setInterval(changed, 15000);
  const expiry = setTimeout(() => res.end(), 300000);
  req.on("close", () => { clearInterval(timer); clearTimeout(expiry); chatEvents.off(req.user.userId, changed); });
});
router.get("/chats/unread", asyncHandler(async (req, res) => {
  const rows = await Message.aggregate([
    { $match: { receiverId: new mongoose.Types.ObjectId(req.user.userId), read: false } },
    { $sort: { _id: -1 } },
    { $group: { _id: "$matchId", count: { $sum: 1 }, senderId: { $first: "$senderId" }, latestId: { $first: "$_id" } } },
    { $lookup: { from: "matches", localField: "_id", foreignField: "_id", as: "match" } },
    { $match: { "match.status": "active" } },
    { $lookup: { from: "users", localField: "senderId", foreignField: "_id", as: "sender" } },
    { $match: { "sender.isActive": true, "sender.isVerified": true } },
    { $sort: { latestId: -1 } },
    { $project: { count: 1, latestId: 1, name: { $arrayElemAt: ["$sender.firstName", 0] } } },
  ]);
  res.json({ total: rows.reduce((sum, row) => sum + row.count, 0), conversations: rows.map(row => ({ id: String(row._id), name: row.name || "Your match", count: row.count, latestId: String(row.latestId) })) });
}));
const participant = userId => ({ $or: [{ user1: userId }, { user2: userId }], status: "active" });
const publicMessage = (row, userId) => ({ id: String(row._id), text: row.message, mine: String(row.senderId) === userId, sentAt: row.createdAt, read: Boolean(row.read) });

async function conversation(req, res, next) {
  if (!isObjectIdString(req.params.id)) return res.status(400).json({ message: "Invalid conversation" });
  const match = await Match.findOne({ _id: req.params.id, ...participant(req.user.userId) }).lean();
  if (!match) return res.status(404).json({ message: "Conversation unavailable" });
  const partnerId = String(match.user1) === req.user.userId ? match.user2 : match.user1;
  const partner = await User.findOne({ _id: partnerId, isActive: true, isVerified: true, deletionRequestedAt: null }).select("_id").lean();
  if (!partner) return res.status(404).json({ message: "Conversation unavailable" });
  req.chat = { match, partnerId };
  next();
}
router.get("/chats", asyncHandler(async (req, res) => {
  const { before } = req.query;
  if (before && !isObjectIdString(before)) return res.status(400).json({ message: "Invalid conversation page" });
  const filter = participant(req.user.userId);
  if (before) filter._id = { $lt: before };
  const matches = await Match.find(filter).sort({ _id: -1 }).limit(21).lean();
  const page = matches.slice(0, 20);
  const partnerId = match => String(match.user1) === req.user.userId ? String(match.user2) : String(match.user1);
  const ids = page.map(partnerId);
  const [users, profiles, latest] = await Promise.all([
    User.find({ _id: { $in: ids }, isActive: true, isVerified: true }).select("firstName").lean(),
    Profile.find({ userId: { $in: ids } }).select("userId profileName avatar").lean(),
    Message.aggregate([{ $match: { matchId: { $in: page.map(m => m._id) } } }, { $sort: { _id: -1 } }, { $group: { _id: "$matchId", text: { $first: "$message" }, sentAt: { $first: "$createdAt" } } }]),
  ]);
  const userMap = new Map(users.map(u => [String(u._id), u]));
  const profileMap = new Map(profiles.map(p => [String(p.userId), p]));
  const lastMap = new Map(latest.map(m => [String(m._id), m]));
  res.json({ conversations: page.filter(m => userMap.has(partnerId(m))).map(m => {
    const id = partnerId(m), profile = profileMap.get(id), last = lastMap.get(String(m._id));
    return { id: String(m._id), name: profile?.profileName || userMap.get(id).firstName || "Your match", avatarPath: profile?.avatar || null,
      matchedAt: m.createdAt, lastMessage: last?.text || "", lastMessageAt: last?.sentAt || null };
  }), nextCursor: matches.length > 20 ? String(page[page.length - 1]._id) : null });
}));
router.get("/chats/:id/messages", asyncHandler(conversation), asyncHandler(async (req, res) => {
  const { before } = req.query;
  if (before && !isObjectIdString(before)) return res.status(400).json({ message: "Invalid message page" });
  const filter = { matchId: req.chat.match._id };
  if (before) filter._id = { $lt: new mongoose.Types.ObjectId(before) };
  const rows = await Message.find(filter).sort({ _id: -1 }).limit(41).lean();
  const page = rows.slice(0, 40);
  const reviewed = Boolean(await Rating.exists({ reviewerId: req.user.userId, reviewedUserId: req.chat.partnerId }));
  res.json({ reviewed, messages: page.slice().reverse().map(m => publicMessage(m, req.user.userId)), nextCursor: rows.length > 40 ? String(page[page.length - 1]._id) : null });
}));
router.get("/chats/:id/profile", asyncHandler(conversation), asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ userId: req.chat.partnerId })
    .select("profileName bio gender dateOfBirth avatar photos interests lookingFor.intents").lean();
  if (!profile) return res.status(404).json({ message: "Profile unavailable" });
  const user = await User.findById(req.chat.partnerId).select("firstName").lean();
  res.json({ id: String(req.chat.partnerId), name: profile.profileName || user?.firstName || "Your match",
    age: require("../controllers/authController").calculateAge(profile.dateOfBirth), gender: profile.gender,
    bio: profile.bio || "", avatarPath: profile.avatar || null, photoPaths: profile.photos || [],
    tags: profile.interests || [], lookingFor: profile.lookingFor?.intents || [] });
}));
router.post("/chats/:id/messages", asyncHandler(conversation), asyncHandler(async (req, res) => {
  const text = req.body?.text;
  if (typeof text !== "string" || !text.trim() || text.length > 5000) return res.status(400).json({ message: "Write a message between 1 and 5,000 characters" });
  const row = await Message.create({ matchId: req.chat.match._id, senderId: req.user.userId, receiverId: req.chat.partnerId, message: text.trim() });
  chatEvents.emit(String(req.chat.partnerId));
  require("../utils/push").sendPush(req.chat.partnerId, { title: "You have a new PostDate message", url: `/messages?match=${req.chat.match._id}` }).catch(() => {});
  res.status(201).json(publicMessage(row, req.user.userId));
}));
router.post("/chats/:id/read", asyncHandler(conversation), asyncHandler(async (req, res) => {
  if (!isObjectIdString(req.body.before)) return res.status(400).json({ message: "Invalid message" });
  await Message.updateMany({ matchId: req.chat.match._id, receiverId: req.user.userId, _id: { $lte: req.body.before }, read: false }, { $set: { read: true } });
  chatEvents.emit(req.user.userId);
  res.sendStatus(204);
}));
for (const [action, status] of [["unmatch", "unmatched"], ["block", "blocked"]]) {
  router.post(`/chats/:id/${action}`, asyncHandler(conversation), asyncHandler(async (req, res) => {
    await Match.updateOne({ _id: req.chat.match._id, status: "active" }, { $set: { status }, ...(action === "block" ? { $addToSet: { blockedBy: req.user.userId } } : {}) });
    chatEvents.emit(req.user.userId);
    chatEvents.emit(String(req.chat.partnerId));
    res.sendStatus(204);
  }));
}
module.exports = router;
