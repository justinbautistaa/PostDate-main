const User = require("../models/User");
const Swipe = require("../models/Swipe");
const Match = require("../models/Match");
const Profile = require("../models/Profile");

module.exports = async function connectionNotices(userId) {
  const through = new Date();
  const [me, likes, matches] = await Promise.all([
    User.findById(userId).select("+connectionNoticesReadAt").lean(),
    Swipe.find({ toUserId: userId, action: "like" }).sort({ createdAt: -1 }).limit(100).lean(),
    Match.find({ $or: [{ user1: userId }, { user2: userId }] }).select("user1 user2 status createdAt").lean(),
  ]);
  const partner = row => String(row.user1) === userId ? String(row.user2) : String(row.user1);
  const pairs = new Map(matches.map(row => [partner(row), row]));
  const candidates = likes.filter(row => !pairs.has(String(row.fromUserId))).map(row => ({
    id: `like:${row._id}`, kind: "like", partnerId: String(row.fromUserId), at: row.createdAt, href: `/discover?profile=${row.fromUserId}`,
  })).concat(matches.filter(row => row.status === "active").map(row => ({
    id: `match:${row._id}`, kind: "match", partnerId: partner(row), at: row.createdAt, href: `/messages?match=${row._id}`,
  })));
  const ids = candidates.map(row => row.partnerId);
  const [users, profiles, passes] = await Promise.all([
    User.find({ _id: { $in: ids }, role: "user", isActive: true, isVerified: true, emailVerifiedAt: { $ne: null }, deletionRequestedAt: null }).select("firstName").lean(),
    Profile.find({ userId: { $in: ids } }).select("userId profileName discoverable").lean(),
    Swipe.find({ fromUserId: userId, toUserId: { $in: ids }, action: "pass" }).select("toUserId").lean(),
  ]);
  const profileMap = new Map(profiles.map(row => [String(row.userId), row]));
  const passed = new Set(passes.map(row => String(row.toUserId)));
  const names = new Map(users.map(row => [String(row._id), profileMap.get(String(row._id))?.profileName || row.firstName]));
  const rows = candidates.filter(row => names.has(row.partnerId) && (row.kind === "match" ||
    (!passed.has(row.partnerId) && profileMap.has(row.partnerId) && profileMap.get(row.partnerId).discoverable !== false)))
    .sort((a, b) => b.at - a.at).slice(0, 30).map(({ partnerId, ...row }) => ({
    ...row, name: names.get(partnerId), unread: !me?.connectionNoticesReadAt || row.at > me.connectionNoticesReadAt,
  }));
  return { through: through.toISOString(), total: rows.filter(row => row.unread).length, rows };
};
