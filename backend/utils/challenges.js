const crypto = require("crypto");
const Challenge = require("../models/Challenge");
const { sendCode } = require("./mail");
const digest = value => crypto.createHmac("sha256", process.env.JWT_SECRET).update(value).digest("hex");
async function issue(user, purpose) {
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
  const record = await Challenge.findOneAndUpdate({ userId: user._id, purpose }, {
    digest: digest(code), attempts: 0, expiresAt: new Date(Date.now() + 300000),
  }, { upsert: true, new: true });
  try { await sendCode(user.email, code, purpose); }
  catch (error) { await Challenge.deleteOne({ _id: record._id, digest: digest(code) }); throw error; }
}
async function consume(userId, purpose, code) {
  if (typeof code !== "string" || code.length > 128) return false;
  // Reserve an attempt atomically so parallel guesses cannot bypass the limit.
  const record = await Challenge.findOneAndUpdate({
    userId, purpose, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 },
  }, { $inc: { attempts: 1 } }, { new: true });
  if (!record || record.digest !== digest(code)) return false;
  const result = await Challenge.deleteOne({ _id: record._id, digest: record.digest });
  return result.deletedCount === 1;
}
module.exports = { digest, issue, consume };
