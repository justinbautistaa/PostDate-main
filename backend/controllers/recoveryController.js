const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { isValidEmail } = require("../utils/validators");
const { emailCode } = require("../utils/verification");

const digest = (value) => crypto.createHmac("sha256", process.env.JWT_SECRET).update(`password-recovery:${value}`).digest("hex");
const codeDigest = (email, code) => digest(`${email}:${code}`);

async function requestRecovery(req, res) {
  const { email } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address" });
  if (!require("../utils/verification").emailConfigured()) return res.status(503).json({ message: "Email delivery is not configured" });
  const address = email.trim().toLowerCase();
  const code = String(crypto.randomInt(1000000)).padStart(6, "0");
  const hash = codeDigest(address, code);
  const user = await User.findOneAndUpdate({
    email: address,
    $or: [{ recoverySentAt: { $exists: false } }, { recoverySentAt: { $lt: new Date(Date.now() - 60000) } }],
  }, {
    $set: { recoveryHash: hash, recoveryExpiresAt: new Date(Date.now() + 300000), recoveryAttempts: 0, recoverySentAt: new Date() },
    $unset: { resetTokenHash: 1, resetExpiresAt: 1 },
  });
  if (user) {
    try { await emailCode(address, code, "recovery"); }
    catch (error) {
      await User.updateOne({ _id: user._id, recoveryHash: hash }, { $unset: { recoveryHash: 1, recoveryExpiresAt: 1, recoverySentAt: 1 } });
      // Preserve a generic acknowledgement so provider errors do not enumerate accounts.
      console.error("[recovery] delivery failed", ["EAUTH", "ESOCKET", "ETIMEDOUT"].includes(error.code) ? error.code : "provider error");
    }
  }
  return res.json({ expiresInSeconds: 300, resendAfterSeconds: 60 });
}

async function verifyRecovery(req, res) {
  const { email, code } = req.body || {};
  if (!isValidEmail(email) || typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: "Enter a valid email and six-digit code" });
  }
  const address = email.trim().toLowerCase();
  const hash = codeDigest(address, code);
  const candidate = await User.findOneAndUpdate({
    email: address, recoveryExpiresAt: { $gt: new Date() }, recoveryAttempts: { $lt: 5 },
  }, { $inc: { recoveryAttempts: 1 } }, { new: true }).select("+recoveryHash");
  if (!candidate?.recoveryHash || !crypto.timingSafeEqual(Buffer.from(candidate.recoveryHash, "hex"), Buffer.from(hash, "hex"))) {
    return res.status(400).json({ message: "Invalid or expired recovery code" });
  }
  const resetToken = crypto.randomBytes(32).toString("hex");
  const updated = await User.findOneAndUpdate({
    _id: candidate._id, recoveryHash: hash, recoveryExpiresAt: { $gt: new Date() },
  }, {
    $set: { resetTokenHash: digest(resetToken), resetExpiresAt: new Date(Date.now() + 600000) },
    $unset: { recoveryHash: 1, recoveryExpiresAt: 1, recoveryAttempts: 1 },
  });
  if (!updated) return res.status(400).json({ message: "Invalid or expired recovery code" });
  return res.json({ resetToken });
}

async function resetPassword(req, res) {
  const { resetToken, newPassword } = req.body || {};
  if (typeof resetToken !== "string" || !/^[a-f0-9]{64}$/.test(resetToken) ||
      typeof newPassword !== "string" || newPassword.length < 12 || Buffer.byteLength(newPassword, "utf8") > 72) {
    return res.status(400).json({ message: "Use a valid reset token and a password of at least 12 characters, at most 72 UTF-8 bytes" });
  }
  const filter = { resetTokenHash: digest(resetToken), resetExpiresAt: { $gt: new Date() } };
  if (!await User.exists(filter)) return res.status(400).json({ message: "Invalid or expired password reset" });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  // Consume only once, including concurrent reset requests. Never reactivate an account.
  const user = await User.findOneAndUpdate(filter, {
    $set: { passwordHash }, $inc: { sessionVersion: 1 },
    $unset: { resetTokenHash: 1, resetExpiresAt: 1, recoveryHash: 1, recoveryExpiresAt: 1, recoverySentAt: 1, recoveryAttempts: 1 },
  });
  if (!user) return res.status(400).json({ message: "Invalid or expired password reset" });
  return res.json({ ok: true });
}

module.exports = { requestRecovery, verifyRecovery, resetPassword, codeDigest, digest };
