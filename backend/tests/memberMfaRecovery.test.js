const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/User");
const Challenge = require("../models/MfaChallenge");
const { recoverMemberMfa } = require("../utils/memberMfaRecovery");
let mongo;
const input = { email: "member@example.test", requestId: "a".repeat(64), caseReference: "SUPPORT-123", ownershipVerified: true };
beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
afterEach(async () => { await mongoose.connection.db.dropDatabase(); });
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });
const account = extra => User.create({ firstName: "Test", lastName: "Member", email: input.email,
  passwordHash: "unchanged", role: "user", isVerified: true, emailVerifiedAt: new Date(),
  mfaEnabled: true, mfaSecret: "secret", mfaRecoveryHashes: ["old"], ...extra });
test.each([{ ownershipVerified: false }, { caseReference: "" }, { requestId: "weak" }])("refuses missing ownership evidence %#", async change => {
  await account();
  await expect(recoverMemberMfa({ ...input, ...change })).rejects.toThrow(/verification/);
  expect((await User.findOne()).mfaEnabled).toBe(true);
});
test.each([{ role: "admin" }, { isActive: false }, { emailVerifiedAt: null }, { deletionRequestedAt: new Date() }])("refuses ineligible account %#", async extra => {
  await account(extra);
  await expect(recoverMemberMfa(input)).rejects.toThrow(/eligible/);
});
test("recovery revokes sessions and factors, records its case, and cannot reset a replacement", async () => {
  const user = await account();
  const other = await account({ email: "other@example.test" });
  await Challenge.create({ userId: user.id, tokenHash: "old", version: 0, expiresAt: new Date(Date.now() + 300000) });
  expect(await recoverMemberMfa(input)).toBe("recovered");
  const changed = await User.findById(user.id).select("+passwordHash +sessionVersion +mfaSecret");
  expect(changed.passwordHash).toBe("unchanged");
  expect(changed.sessionVersion).toBe(1);
  expect(changed.mfaEnabled).toBe(false);
  expect(changed.mfaSecret).toBeUndefined();
  expect(await Challenge.countDocuments({ userId: user.id })).toBe(0);
  expect((await User.findById(other.id)).mfaEnabled).toBe(true);
  expect(await mongoose.connection.db.collection("mfaRecoveryAudit").countDocuments({ caseReference: input.caseReference })).toBe(1);
  await User.updateOne({ _id: user.id }, { $set: { mfaEnabled: true, mfaSecret: "replacement" } });
  await Challenge.create({ userId: user.id, tokenHash: "new", version: 1, expiresAt: new Date(Date.now() + 300000) });
  expect(await recoverMemberMfa(input)).toBe("already_applied");
  expect((await User.findById(user.id).select("+mfaSecret")).mfaSecret).toBe("replacement");
  expect(await Challenge.countDocuments({ userId: user.id })).toBe(1);
});
