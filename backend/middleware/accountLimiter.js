const crypto = require("crypto");
const RequestBucket = require("../models/RequestBucket");
const { isValidEmail } = require("../utils/validators");
// Shared by all backend instances. Store a keyed digest, never the email.
function accountLimiter(purpose, max, windowMs = 15 * 60 * 1000) {
  return async (req, res, next) => {
    if (!isValidEmail(req.body?.email)) return next();
    try {
      const window = Math.floor(Date.now() / windowMs);
      const key = crypto.createHmac("sha256", process.env.JWT_SECRET)
        .update(`${purpose}:${window}:${req.body.email.trim().toLowerCase()}`).digest("hex");
      const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 1) * windowMs) } };
      let bucket;
      try { bucket = await RequestBucket.findOneAndUpdate({ key }, update, { upsert: true, new: true }); }
      catch (error) {
        if (error.code !== 11000) throw error;
        bucket = await RequestBucket.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
      }
      if (!bucket || bucket.count > max) {
        res.set("Retry-After", String(Math.max(1, Math.ceil(((window + 1) * windowMs - Date.now()) / 1000))));
        return res.status(429).json({ message: "Too many attempts. Please try again later." });
      }
      next();
    } catch (error) { next(error); }
  };
}
module.exports = { accountLimiter };
