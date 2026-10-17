const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/User");
const Challenge = require("../models/MfaChallenge");
const { recoverStaffMfa } = require("../utils/staffMfaRecovery");
const crypto = require("crypto");
let mongo;
const env = { NODE_ENV: "production", STAFF_MFA_RECOVERY_EMAIL: "owner@example.test", STAFF_MFA_RECOVERY_REQUEST_ID: "a".repeat(64) };
async function account(email = env.STAFF_MFA_RECOVERY_EMAIL, extra = {}) {
  return User.create({ email, firstName: "Owner", lastName: "Test", role: "admin", isActive: true, isVerified: true, passwordHash: "preserved-password-hash", mfaEnabled: true, mfaSecret: "old-encrypted-secret", mfaRecoveryHashes: ["old-recovery-hash"], ...extra });
}
beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
afterEach(async () => { await Promise.all(Object.values(mongoose.models).map(model => model.deleteMany({}))); });
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test("does nothing without operator configuration and refuses incomplete or nonproduction requests", async () => {
  expect(await recoverStaffMfa({})).toBe("disabled");
  for (const change of [{ NODE_ENV: "development" }, { STAFF_MFA_RECOVERY_REQUEST_ID: "" }, { STAFF_MFA_RECOVERY_EMAIL: "invalid" }]) {
    await expect(recoverStaffMfa({ ...env, ...change })).rejects.toThrow();
  }
});
test.each([{ role: "user" }, { isActive: false }, { isVerified: false }, { deletionRequestedAt: new Date() }])("refuses an ineligible account %#", async extra => {
  const user = await account(undefined, extra);
  await expect(recoverStaffMfa(env)).rejects.toThrow("No eligible staff account");
  expect((await User.findById(user.id)).mfaEnabled).toBe(true);
});
test("recovers only the named staff account, revokes sessions and factors, and preserves its password and role", async () => {
  const user = await account();
  const other = await account("other@example.test");
  await Challenge.create({ tokenHash: "pending", userId: user.id, version: 0, expiresAt: new Date(Date.now() + 300000) });
  expect(await recoverStaffMfa(env)).toBe("recovered");
  const changed = await User.findById(user.id).select("+passwordHash +sessionVersion +mfaSecret +mfaRecoveryHashes +mfaRecoveryRequestHash");
  expect(changed.passwordHash).toBe("preserved-password-hash");
  expect(changed.role).toBe("admin");
  expect(changed.isActive).toBe(true);
  expect(changed.mfaEnabled).toBe(false);
  expect(changed.sessionVersion).toBe(1);
  expect(changed.mfaSecret).toBeUndefined();
  expect(changed.mfaRecoveryHashes || []).toEqual([]);
  expect(changed.mfaRecoveryRequestHash).toBe(crypto.createHash("sha256").update(env.STAFF_MFA_RECOVERY_REQUEST_ID).digest("hex"));
  expect(await Challenge.countDocuments({ userId: user.id })).toBe(0);
  expect((await User.findById(other.id)).mfaEnabled).toBe(true);
  const { staffRequired } = require("../utils/mfa");
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try { expect(staffRequired(changed.role)).toBe(true); } finally { process.env.NODE_ENV = previous; }
  expect(await require("../models/Activity").countDocuments({ category: "security", method: "OPERATOR" })).toBe(1);
});
test("the same request cannot reset a replacement authenticator after a restart", async () => {
  const user = await account();
  const results = await Promise.all([recoverStaffMfa(env), recoverStaffMfa(env)]);
  expect(results.sort()).toEqual(["already_applied", "recovered"]);
  await User.updateOne({ _id: user.id }, { $set: { mfaEnabled: true, mfaSecret: "replacement-secret", mfaRecoveryHashes: ["replacement-hash"] } });
  expect(await recoverStaffMfa(env)).toBe("already_applied");
  const retained = await User.findById(user.id).select("+sessionVersion +mfaSecret");
  expect(retained.mfaEnabled).toBe(true);
  expect(retained.mfaSecret).toBe("replacement-secret");
  expect(retained.sessionVersion).toBe(1);
  expect((await User.findById(user.id)).toJSON().mfaRecoveryRequestHash).toBeUndefined();
});
