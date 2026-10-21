const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/User");
const { recoverAccountMfa } = require("../utils/accountMfaRecovery");
let mongo;
const env = { NODE_ENV: "production", ACCOUNT_MFA_RECOVERY_EMAIL: "owner@example.test",
  ACCOUNT_MFA_RECOVERY_REQUEST_ID: "b".repeat(64), ACCOUNT_MFA_RECOVERY_OWNER_AUTHORIZED: "true" };
const fixture = extra => User.create({ email: env.ACCOUNT_MFA_RECOVERY_EMAIL, firstName: "Owner",
  lastName: "Test", role: "user", isActive: true, isVerified: true, passwordHash: "keep-password",
  mfaEnabled: true, mfaSecret: "old-factor", mfaRecoveryHashes: ["old-code"], ...extra });
beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
afterEach(async () => { await Promise.all(Object.values(mongoose.models).map(model => model.deleteMany({}))); });
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
test("disabled by default and refuses missing authorization, malformed and nonproduction configuration", async () => {
  expect(await recoverAccountMfa({})).toBe("disabled");
  for (const extra of [{ ACCOUNT_MFA_RECOVERY_OWNER_AUTHORIZED: "false" }, { NODE_ENV: "development" },
    { ACCOUNT_MFA_RECOVERY_REQUEST_ID: "bad" }, { ACCOUNT_MFA_RECOVERY_EMAIL: "bad" }]) {
    await expect(recoverAccountMfa({ ...env, ...extra })).rejects.toThrow();
  }
});
test.each(["user", "admin", "moderator"])("resets only the authorized %s account and cannot replay against a replacement factor", async role => {
  const user = await fixture({ role });
  const other = await fixture({ email: "other@example.test" });
  await require("../models/MfaChallenge").create({ userId: user._id, tokenHash: "pending", version: 0,
    expiresAt: new Date(Date.now() + 300000) });
  expect(await recoverAccountMfa(env)).toBe("recovered");
  const changed = await User.findById(user._id).select("+passwordHash +sessionVersion +mfaSecret +mfaRecoveryHashes +mfaEnrollmentDeferred");
  expect(changed.passwordHash).toBe("keep-password");
  expect(changed.role).toBe(role);
  expect(changed.mfaEnabled).toBe(false);
  expect(changed.sessionVersion).toBe(1);
  expect(changed.mfaSecret).toBeUndefined();
  expect(changed.mfaRecoveryHashes || []).toEqual([]);
  expect(changed.mfaEnrollmentDeferred).toBe(role !== "user");
  expect(await require("../models/MfaChallenge").countDocuments({ userId: user._id })).toBe(0);
  expect((await User.findById(other._id)).mfaEnabled).toBe(true);
  await User.updateOne({ _id: user._id }, { $set: { mfaEnabled: true, mfaSecret: "replacement" } });
  expect(await recoverAccountMfa(env)).toBe("already_applied");
  expect((await User.findById(user._id).select("+mfaSecret")).mfaSecret).toBe("replacement");
});
test.each([{ isActive: false }, { isVerified: false }, { deletionRequestedAt: new Date() }])("refuses ineligible accounts %#", async extra => {
  const user = await fixture(extra);
  await expect(recoverAccountMfa(env)).rejects.toThrow();
  expect((await User.findById(user._id)).mfaEnabled).toBe(true);
});
