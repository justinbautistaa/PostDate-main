const crypto = require("crypto");
const { isValidEmail } = require("./validators");

// Operator-only. Email/password recovery alone must never bypass an existing
// second factor. The operator must verify ownership independently first.
async function recoverMemberMfa({ email, requestId, caseReference, ownershipVerified } = {}) {
  if (!isValidEmail(email) || !/^[a-f0-9]{64}$/.test(requestId || "") ||
      typeof caseReference !== "string" || !/^[A-Za-z0-9_-]{3,80}$/.test(caseReference) || ownershipVerified !== true) {
    throw new Error("Independent ownership verification, case reference and recovery request ID are required");
  }
  const User = require("../models/User");
  const requestHash = crypto.createHash("sha256").update(requestId).digest("hex");
  const target = { email: email.trim().toLowerCase(), role: "user", isActive: true,
    isVerified: true, emailVerifiedAt: { $ne: null }, deletionRequestedAt: null };
  const user = await User.findOneAndUpdate({ ...target, mfaEnabled: true,
    mfaRecoveryRequestHash: { $ne: requestHash } }, {
    $set: { mfaEnabled: false, mfaLastCounter: -1, mfaRecoveryRequestHash: requestHash, mfaRecoveredAt: new Date() },
    $inc: { sessionVersion: 1 },
    $unset: { mfaSecret: 1, mfaRecoveryHashes: 1, recoveryHash: 1, recoveryExpiresAt: 1,
      recoverySentAt: 1, recoveryAttempts: 1, resetTokenHash: 1, resetExpiresAt: 1 },
  }, { new: true });
  if (!user && !await User.exists({ ...target, mfaRecoveryRequestHash: requestHash })) {
    throw new Error("No eligible member with MFA enabled");
  }
  // Replaying a request must not delete a replacement authenticator's pending
  // login/enrollment challenges or newly registered devices.
  if (!user) return "already_applied";
  const id = user._id;
  await require("../models/MfaChallenge").deleteMany({ userId: id });
  await require("../models/PushSubscription").deleteMany({ userId: id });
  const db = require("mongoose").connection.db;
  await db.collection("mfaRecoveryAudit").updateOne({ _id: requestHash }, { $setOnInsert: {
    userId: id, caseReference, action: "member-mfa-recovery", ownershipVerified: true, createdAt: new Date(),
  } }, { upsert: true });
  return user ? "recovered" : "already_applied";
}
module.exports = { recoverMemberMfa };
