const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");
process.env.JWT_SECRET = "chat-test-only-secret-long-enough-123456789";
const { createApp } = require("../server");
const User = require("../models/User");
const Match = require("../models/Match");
const Message = require("../models/Message");
let mongo, app, alice, bob, stranger, match;
const cookie = user => `postdate=${jwt.sign({ userId: String(user._id), version: 0 }, process.env.JWT_SECRET, { issuer: "postdate", audience: "postdate-web", expiresIn: "1h" })}`;
const call = (method, path, user = alice) => request(app)[method](`/api${path}`).set("Cookie", cookie(user)).set("X-Postdate-Request", "1");
beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); app = createApp(); });
beforeEach(async () => {
  await Promise.all([Message.deleteMany({}), Match.deleteMany({}), User.deleteMany({})]);
  [alice, bob, stranger] = await User.create(["Alice", "Bob", "Stranger"].map(firstName => ({ firstName, lastName: "Test", email: `${firstName}@example.test`, passwordHash: "unused", isVerified: true, emailVerifiedAt: new Date() })));
  match = await Match.create({ user1: alice._id, user2: bob._id });
});
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
test("chats require authentication", async () => { await request(app).get("/api/chats").expect(401); });
test("only the blocker can unblock, and the conversation is not automatically restored", async () => {
  await call("post", `/chats/${match.id}/block`).expect(204);
  expect((await call("get", "/chats/blocked")).body).toEqual([{ id: match.id, name: "Bob" }]);
  expect((await call("get", "/chats/blocked", bob)).body).toEqual([]);
  await call("post", `/chats/${match.id}/unblock`, bob).expect(404);
  await call("post", `/chats/${match.id}/unblock`).expect(204);
  expect((await call("get", "/chats/blocked")).body).toEqual([]);
  expect((await Match.findById(match.id)).status).toBe("unmatched");
  await call("post", `/chats/${match.id}/messages`).send({ text: "No automatic contact" }).expect(404);
});
test("push subscriptions are validated, private, revoked at logout, and send generic alerts", async () => {
  const webpush = require("web-push"), crypto = require("crypto");
  const { sendPush, validEndpoint } = require("../utils/push");
  const original = { public: process.env.VAPID_PUBLIC_KEY, private: process.env.VAPID_PRIVATE_KEY, subject: process.env.VAPID_SUBJECT };
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey; process.env.VAPID_PRIVATE_KEY = keys.privateKey; process.env.VAPID_SUBJECT = "mailto:test@example.test";
  const delivery = jest.spyOn(webpush, "sendNotification").mockResolvedValue({ statusCode: 201 });
  try {
    const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/test-only-endpoint", keys: { auth: crypto.randomBytes(16).toString("base64url"), p256dh: keys.publicKey } };
    expect(validEndpoint("https://127.0.0.1/private")).toBe(false);
    expect(validEndpoint("https://fcm.googleapis.com.evil.test/x")).toBe(false);
    await call("post", "/push/subscribe").send({ ...sub, endpoint: "http://localhost/private" }).expect(400);
    await call("post", "/push/subscribe").send(sub).expect(204);
    expect((await call("post", "/push/status").send({ endpoint: sub.endpoint }).expect(200)).body).toEqual({ enabled: true });
    expect((await call("post", "/push/status", bob).send({ endpoint: sub.endpoint }).expect(200)).body).toEqual({ enabled: false });
    await require("../models/PushSubscription").updateOne({ endpoint: sub.endpoint }, { sessionVersion: 9 });
    expect((await call("post", "/push/status").send({ endpoint: sub.endpoint }).expect(200)).body).toEqual({ enabled: false });
    await call("post", "/push/subscribe").send(sub).expect(204);
    await call("post", "/push/status").send({ endpoint: "https://127.0.0.1/private" }).expect(400);
    await call("post", "/push/subscribe", bob).send(sub).expect(409);
    await sendPush(alice.id, { title: "You have a new PostDate message", url: `/messages?match=${match.id}` });
    expect(JSON.parse(delivery.mock.calls[0][1])).toEqual({ title: "You have a new PostDate message", body: "Open PostDate to view your update.", url: `/messages?match=${match.id}` });
    await call("post", "/auth/logout").expect(200);
    expect(await require("../models/PushSubscription").countDocuments({ userId: alice.id })).toBe(0);
  } finally {
    delivery.mockRestore();
    for (const [key, value] of [["VAPID_PUBLIC_KEY", original.public], ["VAPID_PRIVATE_KEY", original.private], ["VAPID_SUBJECT", original.subject]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
test("members track their own report decisions without receiving private staff notes", async () => {
  const Report = require("../models/Report");
  await Report.deleteMany({});
  const own = await Report.create({ reporterId: alice._id, reportedUserId: bob._id, targetId: bob._id, targetType: "user", reason: "Harassment", description: "My concern" });
  await Report.create({ reporterId: bob._id, targetId: alice._id, targetType: "user", reason: "Other", description: "Someone else's private report" });
  await request(app).get("/api/reports/mine").expect(401);
  const initial = (await call("get", "/reports/mine").expect(200)).body;
  expect(initial.reports).toHaveLength(1);
  expect(initial.reports[0]).toMatchObject({ id: own.id, status: "pending", description: "My concern" });
  stranger.role = "admin"; await stranger.save();
  await call("patch", `/admin/reports/${own.id}`, stranger).send({ status: "resolved", note: "Internal investigation details" }).expect(200);
  const updated = (await call("get", "/reports/mine").expect(200)).body;
  expect(updated.reports[0]).toMatchObject({ status: "resolved", resolvedAt: expect.any(String) });
  expect((await call("get", "/reports/updates")).body).toEqual([expect.objectContaining({ id: own.id, status: "resolved" })]);
  await call("post", "/reports/seen", bob).send({ reports: [{ id: own.id, updatedAt: updated.reports[0].updatedAt }] }).expect(204);
  expect((await call("get", "/reports/updates")).body).toHaveLength(1);
  await call("post", "/reports/seen").send({ reports: [{ id: own.id, updatedAt: updated.reports[0].updatedAt }] }).expect(204);
  expect((await call("get", "/reports/updates")).body).toEqual([]);
  expect(JSON.stringify(updated)).not.toMatch(/Internal investigation|resolutionNote|resolvedBy|Someone else/);
  await call("get", "/reports/mine?before=invalid").expect(400);
});
test.each(["block", "unmatch"])("participants can %s and neither person can restart contact", async action => {
  const Profile = require("../models/Profile");
  await Profile.deleteMany({});
  await Profile.create({ userId: bob._id, profileName: "Bob", dateOfBirth: new Date("1998-05-14"), gender: "male" });
  await call("post", `/chats/${match.id}/${action}`, stranger).expect(404);
  await call("post", `/chats/${match.id}/${action}`).expect(204);
  for (const user of [alice, bob]) {
    await call("post", `/chats/${match.id}/messages`, user).send({ text: "No further contact" }).expect(404);
    await call("get", `/chats/${match.id}/profile`, user).expect(404);
    expect((await call("get", "/chats", user)).body.conversations).toEqual([]);
    expect((await call("get", "/matches/history", user)).body.matches).toEqual([]);
  }
  expect((await call("get", "/discover")).body.profiles.some(profile => profile.id === bob.id)).toBe(false);
  await call("post", "/discover/like").send({ profileId: bob.id }).expect(404);
});
test("unread notifications belong to the recipient and clear only acknowledged messages", async () => {
  const first = (await call("post", `/chats/${match.id}/messages`).send({ text: "Hello Bob" }).expect(201)).body;
  await call("post", `/chats/${match.id}/messages`).send({ text: "Another hello" }).expect(201);
  expect((await call("get", "/chats/unread", bob)).body).toMatchObject({ total: 2, conversations: [{ id: match.id, name: "Alice", count: 2 }] });
  expect((await call("get", "/chats/unread", stranger)).body.total).toBe(0);
  await call("post", `/chats/${match.id}/read`, stranger).send({ before: first.id }).expect(404);
  await call("post", `/chats/${match.id}/read`, bob).send({ before: first.id }).expect(204);
  expect((await call("get", "/chats/unread", bob)).body.total).toBe(1);
  await Match.updateOne({ _id: match._id }, { status: "blocked" });
  expect((await call("get", "/chats/unread", bob)).body.total).toBe(0);
});
test("only active match participants can view a public profile without private account data", async () => {
  const Profile = require("../models/Profile");
  await Profile.deleteMany({});
  await Profile.create({ userId: bob._id, profileName: "Bob Public", bio: "Hello there", dateOfBirth: new Date("1998-05-14"), gender: "male", interests: ["Hiking"], location: { city: "Private City", country: "Private Country" } });
  await call("get", `/chats/${match.id}/profile`, stranger).expect(404);
  const result = await call("get", `/chats/${match.id}/profile`).expect(200);
  expect(result.body).toMatchObject({ id: bob.id, name: "Bob Public", bio: "Hello there", tags: ["Hiking"] });
  expect(JSON.stringify(result.body)).not.toMatch(/email|password|dateOfBirth|Private City|Private Country|sessionVersion/);
  await Match.updateOne({ _id: match._id }, { status: "blocked" });
  await call("get", `/chats/${match.id}/profile`).expect(404);
});
test("only matched participants can send or read messages, including staff", async () => {
  await call("post", `/chats/${match.id}/messages`, stranger).send({ text: "Intrusion" }).expect(404);
  await call("get", `/chats/${match.id}/messages`, stranger).expect(404);
  stranger.role = "admin"; await stranger.save();
  await call("get", `/chats/${match.id}/messages`, stranger).expect(404);
  expect(await Message.countDocuments()).toBe(0);
});
test("a message persists with server-controlled participants and is visible to both", async () => {
  const result = await call("post", `/chats/${match.id}/messages`).send({ text: " Hello Bob! ", senderId: stranger.id }).expect(201);
  expect(result.body).toMatchObject({ text: "Hello Bob!", mine: true });
  const received = await call("get", `/chats/${match.id}/messages`, bob).expect(200);
  expect(received.body.messages[0]).toMatchObject({ id: result.body.id, mine: false, text: "Hello Bob!" });
  const stored = await Message.findById(result.body.id);
  expect(String(stored.senderId)).toBe(alice.id); expect(String(stored.receiverId)).toBe(bob.id);
});
test("chat listing exposes only the participant's matches with latest message", async () => {
  await call("post", `/chats/${match.id}/messages`).send({ text: "Hi there" }).expect(201);
  const own = await call("get", "/chats").expect(200);
  expect(own.body.conversations).toEqual([expect.objectContaining({ id: match.id, name: "Bob", lastMessage: "Hi there" })]);
  expect(JSON.stringify(own.body)).not.toContain("example.test");
  expect((await call("get", "/chats", stranger)).body.conversations).toEqual([]);
});
test.each(["", "   ", "x".repeat(5001), { text: "bad" }])("rejects empty, oversized, or non-text messages %#", async text => {
  await call("post", `/chats/${match.id}/messages`).send({ text }).expect(400);
});
test.each(["unmatched", "blocked"])("%s matches cannot exchange or read messages", async status => {
  await Match.updateOne({ _id: match._id }, { status });
  await call("post", `/chats/${match.id}/messages`).send({ text: "Hello" }).expect(404);
  await call("get", `/chats/${match.id}/messages`).expect(404);
  expect((await call("get", "/chats")).body.conversations).toEqual([]);
});
test("suspended recipients cannot be messaged", async () => {
  await User.updateOne({ _id: bob._id }, { isActive: false });
  await call("post", `/chats/${match.id}/messages`).send({ text: "Hello" }).expect(404);
  expect((await call("get", "/chats")).body.conversations).toEqual([]);
});
test("message pagination keeps chronological order without duplicates", async () => {
  await Message.insertMany(Array.from({ length: 45 }, (_, i) => ({ matchId: match._id, senderId: alice._id, receiverId: bob._id, message: `Message ${i}` })));
  const recent = (await call("get", `/chats/${match.id}/messages`).expect(200)).body;
  expect(recent.messages).toHaveLength(40); expect(recent.nextCursor).toBeTruthy();
  const older = (await call("get", `/chats/${match.id}/messages?before=${recent.nextCursor}`).expect(200)).body;
  expect(older.messages).toHaveLength(5); expect(older.nextCursor).toBeNull();
  expect(new Set([...older.messages, ...recent.messages].map(m => m.id)).size).toBe(45);
});
test("invalid conversation and cursor inputs return validation errors", async () => {
  await call("get", "/chats/not-an-id/messages").expect(400);
  await call("get", `/chats/${match.id}/messages?before=invalid`).expect(400);
  await call("get", "/chats?before=invalid").expect(400);
});
