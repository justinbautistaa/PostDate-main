const crypto = require("crypto");
const { isValidEmail } = require("./validators");

// Operator-only startup action. There is deliberately no HTTP endpoint.
// The durable request hash prevents a retained Render setting from resetting
// the authenticator again after the owner has enrolled a replacement.
async function recoverStaffMfa(env = process.env) {
  const email = env.STAFF_MFA_RECOVERY_EMAIL?.trim().toLowerCase();
  const requestId = env.STAFF_MFA_RECOVERY_REQUEST_ID;
  if (!email && !requestId) return "disabled";
  if (env.NODE_ENV !== "production" || !isValidEmail(email) || !/^[a-f0-9]{64}$/.test(requestId || "")) {
    throw new Error("Invalid operator MFA recovery configuration");
  }
  const User = require("../models/User");
  const requestHash = crypto.createHash("sha256").update(requestId).digest("hex");
  const target = { email, role: { $in: ["admin", "moderator"] }, isActive: true, isVerified: true, deletionRequestedAt: null };
  const user = await User.findOneAndUpdate({ ...target, mfaRecoveryRequestHash: { $ne: requestHash } }, {
    $set: { mfaEnabled: false, mfaEnrollmentDeferred: false, mfaLastCounter: -1, mfaRecoveryRequestHash: requestHash, mfaRecoveredAt: new Date() },
    $inc: { sessionVersion: 1 },
    $unset: { mfaSecret: 1, mfaRecoveryHashes: 1, recoveryHash: 1, recoveryExpiresAt: 1, recoverySentAt: 1, recoveryAttempts: 1, resetTokenHash: 1, resetExpiresAt: 1 },
  }, { new: true });
  if (!user) {
    if (await User.exists({ ...target, mfaRecoveryRequestHash: requestHash })) return "already_applied";
    throw new Error("No eligible staff account for operator MFA recovery");
  }
  await require("../models/MfaChallenge").deleteMany({ userId: user._id });
  await require("../models/PushSubscription").deleteMany({ userId: user._id });
  await require("../models/Activity").create({ actor: user._id, role: "operator", method: "OPERATOR", path: "/internal/staff-mfa-recovery", status: 200, category: "security" });
  return "recovered";
}
module.exports = { recoverStaffMfa };
