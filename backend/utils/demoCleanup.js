const mongoose = require("mongoose");
const User = require("../models/User");
async function cleanupDemo({ apply = false } = {}) {
  const runs = mongoose.connection.db.collection("demoSeedRuns");
  const marker = await runs.findOne({ _id: "postdate-dashboard-demo-v1" });
  if (marker?.status === "cleaned") return { status: "already_cleaned" };
  if (!marker || marker.status !== "complete" || !marker.userIds?.length) throw new Error("No completed demo run to clean");
  const ids = marker.userIds;
  const users = await User.find({ _id: { $in: ids } }).select("email").lean();
  if (users.length !== ids.length || users.some(user => !/@demo\.postdate\.test$/i.test(user.email))) {
    throw new Error("Demo ownership verification failed");
  }
  const Match = require("../models/Match"), Rating = require("../models/Rating"), Report = require("../models/Report");
  const mixed = (a, b) => ({ $or: [
    { [a]: { $in: ids }, [b]: { $nin: ids } }, { [b]: { $in: ids }, [a]: { $nin: ids } },
  ] });
  if (await Match.exists(mixed("user1", "user2")) || await Rating.exists(mixed("reviewerId", "reviewedUserId")) ||
      await Report.exists(mixed("reporterId", "reportedUserId")) ||
      await require("../models/Swipe").exists(mixed("fromUserId", "toUserId")) ||
      await require("../models/Message").exists(mixed("senderId", "receiverId")) ||
      await require("../models/WorkspaceEntry").exists({ member: { $in: ids }, owner: { $nin: ids } }) ||
      await require("../models/Profile").exists({ userId: { $in: ids }, "photos.0": { $exists: true } })) {
    throw new Error("Demo records have real-account interactions or uploaded photos; manual review required");
  }
  const plan = { status: "preview", accounts: ids.length,
    matches: await Match.countDocuments({ user1: { $in: ids }, user2: { $in: ids } }),
    ratings: await Rating.countDocuments({ reviewerId: { $in: ids }, reviewedUserId: { $in: ids } }),
    reports: await Report.countDocuments({ reporterId: { $in: ids }, reportedUserId: { $in: ids } }),
    appeals: await require("../models/Appeal").countDocuments({ userId: { $in: ids } }),
  };
  if (!apply) return plan;
  // Disable first so no new member sessions can act during removal.
  await User.updateMany({ _id: { $in: ids } }, { $set: { isActive: false }, $inc: { sessionVersion: 1 } });
  const byUser = { userId: { $in: ids } };
  for (const name of ["Profile", "Appeal", "MfaChallenge", "PushSubscription"]) await require(`../models/${name}`).deleteMany(byUser);
  await Match.deleteMany({ user1: { $in: ids }, user2: { $in: ids } });
  await Rating.deleteMany({ reviewerId: { $in: ids }, reviewedUserId: { $in: ids } });
  await Report.deleteMany({ reporterId: { $in: ids }, reportedUserId: { $in: ids } });
  await require("../models/Message").deleteMany({ senderId: { $in: ids }, receiverId: { $in: ids } });
  await require("../models/Swipe").deleteMany({ fromUserId: { $in: ids }, toUserId: { $in: ids } });
  await require("../models/WorkspaceEntry").deleteMany({ owner: { $in: ids } });
  await require("../models/AuditLog").deleteMany({ actorId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids }, email: /@demo\.postdate\.test$/i });
  await runs.updateOne({ _id: marker._id }, { $set: { status: "cleaned", cleanedAt: new Date(), cleanupCounts: plan } });
  return { ...plan, status: "cleaned" };
}
module.exports = { cleanupDemo };
