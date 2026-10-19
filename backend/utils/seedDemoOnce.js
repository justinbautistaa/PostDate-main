const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const mongoose = require("mongoose");
const User = require("../models/User");
const run = promisify(execFile);
const RUN_ID = "postdate-dashboard-demo-v1";
const demoEmail = /@demo\.postdate\.test$/;

// Explicit operator switch; a database marker prevents duplicate execution
// across restarts or concurrent instances. No reset or real-account mutation.
async function seedDemoOnce() {
  if (process.env.SEED_DEMO_DATA !== "true") return;
  const runs = mongoose.connection.db.collection("demoSeedRuns");
  const previous = await runs.findOne({ _id: RUN_ID });
  if (previous?.status === "complete") {
    console.log("[demo] Dataset already seeded; skipping");
    return previous.counts;
  }
  if (previous || await User.exists({ email: demoEmail })) {
    throw new Error("Existing or incomplete demo dataset needs manual review");
  }
  await runs.insertOne({ _id: RUN_ID, status: "running", startedAt: new Date() });
  try {
    await run(process.execPath, [path.join(__dirname, "../scripts/seedDemoData.js"), "--force"], {
      env: process.env, windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024,
    });
    const users = await User.find({ email: demoEmail }).select("_id role").lean();
    const ids = users.map(user => user._id);
    const counts = {
      members: users.filter(user => user.role === "user").length,
      moderators: users.filter(user => user.role === "moderator").length,
      matches: await require("../models/Match").countDocuments({ user1: { $in: ids }, user2: { $in: ids } }),
      ratings: await require("../models/Rating").countDocuments({ reviewerId: { $in: ids }, reviewedUserId: { $in: ids } }),
      reports: await require("../models/Report").countDocuments({ reporterId: { $in: ids }, reportedUserId: { $in: ids } }),
      appeals: await require("../models/Appeal").countDocuments({ userId: { $in: ids } }),
    };
    const visible = await require("../models/Profile").countDocuments({ userId: { $in: ids }, discoverable: { $ne: false } });
    if (counts.members !== 64 || counts.moderators !== 2 || counts.matches !== 110 ||
        !counts.ratings || counts.reports !== 28 || counts.appeals > 5 || visible) {
      throw new Error("Demo verification failed");
    }
    await runs.updateOne({ _id: RUN_ID }, { $set: { status: "complete", finishedAt: new Date(), userIds: ids, counts } });
    console.log("[demo] Dataset verified:", JSON.stringify(counts));
    return counts;
  } catch {
    await runs.updateOne({ _id: RUN_ID }, { $set: { status: "failed", finishedAt: new Date() } });
    throw new Error("Demo seeding failed; automatic retries are disabled");
  }
}
module.exports = { seedDemoOnce };
