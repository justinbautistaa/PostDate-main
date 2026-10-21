const crypto = require("crypto");
const { isValidEmail } = require("./validators");

// Operator configuration only, never reachable through an HTTP request.
// A durable request hash prevents resetting a replacement authenticator.
async function recoverAccountMfa(env = process.env) {
  const email = env.ACCOUNT_MFA_RECOVERY_EMAIL?.trim().toLowerCase();
  const requestId = env.ACCOUNT_MFA_RECOVERY_REQUEST_ID;
  if (!email && !requestId) return "disabled";
  if (env.NODE_ENV !== "production" || !isValidEmail(email) ||
      !/^[a-f0-9]{64}$/.test(requestId || "") ||
      env.ACCOUNT_MFA_RECOVERY_OWNER_AUTHORIZED !== "true") {
    throw new Error("Invalid owner-authorized account MFA recovery configuration");
  }
  const User = require("../models/User");
  const requestHash = crypto.createHash("sha256").update(requestId).digest("hex");
  const target = { email, role: { $in: ["user", "admin", "moderator"] },
    isActive: true, isVerified: true, deletionRequestedAt: null };
  const account = await User.findOne(target).select("+mfaRecoveryRequestHash");
  if (!account) throw new Error("No eligible account for MFA recovery");
  if (account.mfaRecoveryRequestHash === requestHash) return "already_applied";
  const user = await User.findOneAndUpdate({ ...target, _id: account._id,
    role: account.role, mfaRecoveryRequestHash: { $ne: requestHash } }, {
    $set: { mfaEnabled: false, mfaEnrollmentDeferred: ["admin", "moderator"].includes(account.role),
      mfaLastCounter: -1, mfaRecoveryRequestHash: requestHash, mfaRecoveredAt: new Date() },
    $inc: { sessionVersion: 1 },
    $unset: { mfaSecret: 1, mfaRecoveryHashes: 1, recoveryHash: 1, recoveryExpiresAt: 1,
      recoverySentAt: 1, recoveryAttempts: 1, resetTokenHash: 1, resetExpiresAt: 1 },
  }, { new: true });
  if (!user) throw new Error("Account changed during MFA recovery; operator review required");
  await require("../models/MfaChallenge").deleteMany({ userId: user._id });
  await require("../models/PushSubscription").deleteMany({ userId: user._id });
  await require("mongoose").connection.db.collection("mfaRecoveryAudit").updateOne(
    { _id: requestHash }, { $setOnInsert: { userId: user._id, action: "owner-authorized-mfa-reset",
      ownerAuthorized: true, createdAt: new Date() } }, { upsert: true });
  return "recovered";
}
module.exports = { recoverAccountMfa };
