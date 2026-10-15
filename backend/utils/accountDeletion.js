const crypto = require("crypto");
const User = require("../models/User"), Profile = require("../models/Profile"), Job = require("../models/DeletionJob");
async function cleanOne() {
  const job = await Job.findOneAndUpdate({ leaseUntil: { $lt: new Date() } }, { $set: { leaseUntil: new Date(Date.now() + 300000) }, $inc: { attempts: 1 } }, { new: true });
  if (!job) return;
  try {
    const id = job.userId;
    await User.updateOne({ _id: id }, { $set: { isActive: false, firstName: "Deleted", lastName: "Member", email: `deleted-${id}@deleted.invalid`, passwordHash: crypto.randomBytes(32).toString("hex"), mfaEnabled: false }, $unset: { middleName: 1, mfaSecret: 1, mfaRecoveryHashes: 1, verificationHash: 1, recoveryHash: 1, resetTokenHash: 1 }, $inc: { sessionVersion: 1 } });
    const profile = await Profile.findOne({ userId: id }).select("photos").lean();
    const photos = [...new Set([...job.photos, ...(profile?.photos || [])])];
    await Job.updateOne({ _id: job._id }, { $set: { photos } });
    await Profile.deleteOne({ userId: id });
    for (const photo of photos) {
      await Job.updateOne({ _id: job._id }, { $set: { leaseUntil: new Date(Date.now() + 300000) } });
      await require("./photoStorage").deletePhotoFile(photo);
    }
    await Promise.all([
      require("../models/PushSubscription").deleteMany({ userId: id }),
      require("../models/MfaChallenge").deleteMany({ userId: id }),
      require("../models/WorkspaceEntry").deleteMany({ owner: id, kind: "plan" }),
      require("../models/Swipe").deleteMany({ $or: [{ fromUserId: id }, { toUserId: id }] }),
      require("../models/Rating").deleteMany({ $or: [{ reviewerId: id }, { reviewedUserId: id }] }),
      require("../models/Message").deleteMany({ senderId: id }),
      require("../models/Match").updateMany({ $or: [{ user1: id }, { user2: id }] }, { $set: { status: "unmatched" } }),
    ]);
    await User.deleteOne({ _id: id }); await Job.deleteOne({ _id: job._id });
  } catch {
    await Job.updateOne({ _id: job._id }, { $set: { leaseUntil: new Date(Date.now() + 60000) } });
    console.error("[privacy] account cleanup will retry");
  }
}
async function requestDeletion(user) {
  const profile = await Profile.findOne({ userId: user._id }).select("photos").lean();
  await Job.findOneAndUpdate({ userId: user._id }, { $setOnInsert: { photos: profile?.photos || [], leaseUntil: new Date(0) } }, { upsert: true });
  await User.updateOne({ _id: user._id }, { $set: { isActive: false, deletionRequestedAt: new Date() }, $inc: { sessionVersion: 1 } });
  await Profile.updateOne({ userId: user._id }, { $set: { discoverable: false } });
}
function startDeletionWorker() {
  let busy = false;
  const run = async () => { if (busy) return; busy = true; try { await cleanOne(); } catch { console.error("[privacy] cleanup unavailable"); } finally { busy = false; } };
  run(); const timer = setInterval(run, 30000); timer.unref(); return () => clearInterval(timer);
}
module.exports = { cleanOne, requestDeletion, startDeletionWorker };
