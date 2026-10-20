const crypto = require('crypto');
const RequestBucket = require('../models/RequestBucket');
const WINDOW_MS = 15 * 60 * 1000;
// Reserve atomically before password comparison so parallel guesses share a budget.
async function reservePasswordAttempt(email, now = Date.now()) {
  const window = Math.floor(now / WINDOW_MS);
  const key = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(`password-failures:${window}:${email.trim().toLowerCase()}`).digest('hex');
  const expiresAt = new Date((window + 1) * WINDOW_MS);
  let bucket;
  try {
    bucket = await RequestBucket.findOneAndUpdate({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true, new: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    bucket = await RequestBucket.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
  }
  if (!bucket) throw new Error('Password attempt store unavailable');
  return { allowed: bucket.count <= 5, retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
    release: () => RequestBucket.updateOne({ key, count: { $gt: 0 } }, { $inc: { count: -1 } }) };
}
module.exports = { reservePasswordAttempt, WINDOW_MS };
