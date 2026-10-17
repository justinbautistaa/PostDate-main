const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { MongoMemoryServer } = require("mongodb-memory-server");
jest.mock("../utils/verification", () => ({ ...jest.requireActual("../utils/verification"), emailCode: jest.fn().mockResolvedValue() }));
process.env.JWT_SECRET = "role-auth-test-only-signing-secret-1234567890";
process.env.MAIL_API_KEY = "test";
process.env.MAIL_FROM = "test@example.test";
const { createApp } = require("../server");
const User = require("../models/User");
const { emailCode } = require("../utils/verification");
let mongo, app;
const call = (method, path) => request(app)[method](`/api${path}`).set("X-Postdate-Request", "1");
const latestCode = (email, purpose) => emailCode.mock.calls.findLast(args => args[0] === email && (purpose === "recovery" ? args[2] === purpose : !args[2]))[1];
beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); app = createApp(); });
afterEach(async () => { await Promise.all(Object.values(mongoose.models).map(model => model.deleteMany({}))); jest.clearAllMocks(); jest.restoreAllMocks(); });
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test.each(["admin", "moderator", "user"])("two independent %s accounts can log in and recover without changing each other", async role => {
  const password = "OriginalSecret123";
  const accounts = await User.create(await Promise.all([1, 2].map(async index => ({ firstName: `Person${index}`, lastName: "Test", email: `${role}${index}@example.test`, passwordHash: await bcrypt.hash(password, 4), role, isVerified: true, ...(role === "user" ? { emailVerifiedAt: new Date() } : {}) }))));
  const sessions = [];
  for (const user of accounts) {
    const login = await call("post", "/auth/login").send({ email: user.email, password }).expect(200);
    expect(login.body).toMatchObject({ userId: user.id, role });
    sessions.push(login.headers["set-cookie"][0].split(";")[0]);
  }
  jest.spyOn(crypto, "randomInt").mockReturnValueOnce(111111).mockReturnValueOnce(222222);
  for (const user of accounts) await call("post", "/auth/recovery/request").send({ email: user.email }).expect(200);
  const firstCode = latestCode(accounts[0].email, "recovery");
  const secondCode = latestCode(accounts[1].email, "recovery");
  expect(firstCode).not.toBe(secondCode);
  await call("post", "/auth/recovery/verify").send({ email: accounts[1].email, code: firstCode }).expect(400);
  const token = (await call("post", "/auth/recovery/verify").send({ email: accounts[0].email, code: firstCode }).expect(200)).body.resetToken;
  await call("post", "/auth/recovery/reset").send({ resetToken: token, newPassword: "ReplacementSecret123", email: accounts[1].email }).expect(200);
  await call("post", "/auth/login").send({ email: accounts[0].email, password }).expect(401);
  await call("post", "/auth/login").send({ email: accounts[0].email, password: "ReplacementSecret123" }).expect(200);
  await call("post", "/auth/login").send({ email: accounts[1].email, password }).expect(200);
  await call("get", "/auth/session").set("Cookie", sessions[0]).expect(401);
  await call("get", "/auth/session").set("Cookie", sessions[1]).expect(200);
  await call("post", "/auth/recovery/verify").send({ email: accounts[1].email, code: secondCode }).expect(200);
});

test("separate new signups receive verification at their own emails and cannot verify each other", async () => {
  const accounts = ["first@example.test", "second@example.test"];
  const password = "NewMemberSecret123";
  jest.spyOn(crypto, "randomInt").mockReturnValueOnce(333333).mockReturnValueOnce(444444);
  for (const email of accounts) {
    await call("post", "/signup").send({ privacyConsent: true, email, password, firstName: "New", lastName: "Member", birthdate: "1998-05-14", gender: "female", role: "admin", isVerified: true }).expect(201);
    expect((await User.findOne({ email })).role).toBe("user");
    await call("post", "/auth/login").send({ email, password }).expect(403);
    await call("post", "/verify/send").send({ email }).expect(200);
  }
  const first = latestCode(accounts[0], "verification"), second = latestCode(accounts[1], "verification");
  expect((await call("post", "/verify/confirm").send({ email: accounts[1], code: first }).expect(200)).body.verified).toBe(false);
  for (const [index, email] of accounts.entries()) {
    expect((await call("post", "/verify/confirm").send({ email, code: index === 0 ? first : second }).expect(200)).body.verified).toBe(true);
    const login = await call("post", "/auth/login").send({ email, password }).expect(200);
    expect(login.body.role).toBe("user");
  }
  expect(await User.countDocuments({ isVerified: true, emailVerifiedAt: { $ne: null } })).toBe(2);
});

test.each(["admin", "moderator", "user"])("recovery cannot reactivate a suspended %s account", async role => {
  const user = await User.create({ email: `${role}@example.test`, firstName: "Suspended", lastName: "Test", passwordHash: "unused", role, isVerified: true, emailVerifiedAt: new Date(), isActive: false });
  await call("post", "/auth/recovery/request").send({ email: user.email }).expect(200);
  const token = (await call("post", "/auth/recovery/verify").send({ email: user.email, code: latestCode(user.email, "recovery") }).expect(200)).body.resetToken;
  await call("post", "/auth/recovery/reset").send({ resetToken: token, newPassword: "ReplacementSecret123" }).expect(200);
  await call("post", "/auth/login").send({ email: user.email, password: "ReplacementSecret123" }).expect(403);
  expect((await User.findById(user.id)).isActive).toBe(false);
});

test.each(["admin", "moderator"])("production %s enrollment and recovery retain MFA and role boundaries", async role => {
  const originalEnvironment = process.env.NODE_ENV;
  const originalKey = process.env.MFA_ENCRYPTION_KEY;
  process.env.NODE_ENV = "production";
  process.env.MFA_ENCRYPTION_KEY = "a".repeat(64);
  try {
    const password = "OriginalSecret123";
    const user = await User.create({ firstName: "Staff", lastName: "Test", email: `${role}@example.test`, passwordHash: await bcrypt.hash(password, 4), role, isVerified: true });
    const pending = await call("post", "/auth/login").send({ email: user.email, password }).expect(200);
    expect(pending.headers["set-cookie"]).toBeUndefined();
    expect(pending.body).toMatchObject({ mfaRequired: true, mfaSetupRequired: true });
    const authenticator = new (require("otpauth").TOTP)({ secret: pending.body.secret });
    const verified = await call("post", "/auth/mfa/verify").send({ challenge: pending.body.challenge, code: authenticator.generate() }).expect(200);
    const oldCookie = verified.headers["set-cookie"][0].split(";")[0];
    expect(verified.headers["set-cookie"][0]).toMatch(/__Host-postdate=.*HttpOnly; Secure; SameSite=Strict/);
    await call("get", "/admin/overview").set("Cookie", oldCookie).expect(200);
    await call("get", "/admin/activity").set("Cookie", oldCookie).expect(role === "admin" ? 200 : 403);
    await call("post", "/auth/mfa/disable").set("Cookie", oldCookie).send({ password, code: verified.body.recoveryCodes[0] }).expect(403);
    await call("post", "/auth/recovery/request").send({ email: user.email }).expect(200);
    const proof = await call("post", "/auth/recovery/verify").send({ email: user.email, code: latestCode(user.email, "recovery") }).expect(200);
    await call("post", "/auth/recovery/reset").send({ resetToken: proof.body.resetToken, newPassword: "ReplacementSecret123" }).expect(200);
    await call("get", "/admin/overview").set("Cookie", oldCookie).expect(401);
    const login = await call("post", "/auth/login").send({ email: user.email, password: "ReplacementSecret123" }).expect(200);
    expect(login.body).toMatchObject({ mfaRequired: true, mfaSetupRequired: false });
    expect(login.headers["set-cookie"]).toBeUndefined();
    const restored = await call("post", "/auth/mfa/verify").send({ challenge: login.body.challenge, code: verified.body.recoveryCodes[0] }).expect(200);
    const cookie = restored.headers["set-cookie"][0].split(";")[0];
    await call("get", "/admin/overview").set("Cookie", cookie).expect(200);
    await call("get", "/admin/activity").set("Cookie", cookie).expect(role === "admin" ? 200 : 403);
  } finally {
    process.env.NODE_ENV = originalEnvironment;
    if (originalKey === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = originalKey;
  }
});
