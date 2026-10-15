const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");
process.env.JWT_SECRET = "workspace-test-only-secret-long-enough-123456789";
const { createApp } = require("../server");
const User = require("../models/User");
const Entry = require("../models/WorkspaceEntry");
let mongo, app, admin, staff, alice, bob;
const cookie = user => `postdate=${jwt.sign({ userId: user.id, version: 0 }, process.env.JWT_SECRET, { issuer: "postdate", audience: "postdate-web", expiresIn: "1h" })}`;
const call = (method, path, user = alice) => request(app)[method](`/api/workspace${path}`).set("Cookie", cookie(user)).set("X-Postdate-Request", "1");
const future = () => new Date(Date.now() + 86400000).toISOString();
beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); app = createApp(); });
beforeEach(async () => {
  await Entry.deleteMany({}); await User.deleteMany({});
  [admin, staff, alice, bob] = await User.create(["admin", "moderator", "user", "user"].map((role, index) => ({ firstName: `Person${index}`, lastName: "Test", email: `person${index}@example.test`, passwordHash: "unused", role, isVerified: true, emailVerifiedAt: new Date() })));
});
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
test("all workspace reads require authentication", async () => {
  for (const kind of ["announcements", "notes", "plans"]) await request(app).get(`/api/workspace/${kind}`).expect(401);
});
test("only admin can publish or remove notices; audience is enforced by server", async () => {
  for (const user of [staff, alice]) await call("post", "/announcements", user).send({ title: "No", audience: "everyone" }).expect(403);
  const entries = [];
  for (const audience of ["members", "staff", "everyone"]) entries.push((await call("post", "/announcements", admin).send({ title: audience, body: "Update", audience }).expect(201)).body);
  expect((await call("get", "/announcements")).body.map(row => row.title).sort()).toEqual(["everyone", "members"]);
  expect((await call("get", "/announcements", staff)).body.map(row => row.title).sort()).toEqual(["everyone", "staff"]);
  expect((await call("get", "/announcements", admin)).body).toHaveLength(3);
  await call("delete", `/${entries[0].id}`, staff).expect(404);
  await call("patch", `/${entries[0].id}`, admin).send({ done: true }).expect(404);
  await call("delete", `/${entries[0].id}`, admin).expect(204);
  expect((await call("get", "/announcements")).body).toHaveLength(1);
});
test("staff can record, share, complete and reopen member follow-ups without exposing them to members", async () => {
  await call("post", "/notes").send({ title: "Secret", member: bob.id }).expect(403);
  await call("get", "/notes").expect(403);
  await call("post", "/notes", staff).send({ title: "Team account", member: admin.id }).expect(404);
  const { body: note } = await call("post", "/notes", staff).send({ title: " Check in ", body: "Needs help", member: alice.id, owner: alice.id }).expect(201);
  expect(note).toMatchObject({ title: "Check in", done: false, member: { id: alice.id, name: "Person2 Test" }, author: "Person1 Test" });
  expect(String((await Entry.findById(note.id)).owner)).toBe(staff.id);
  expect((await call("get", "/notes", admin)).body).toHaveLength(1);
  await call("patch", `/${note.id}`).send({ done: true }).expect(404);
  expect((await call("patch", `/${note.id}`, admin).send({ done: true }).expect(200)).body.done).toBe(true);
  expect((await call("patch", `/${note.id}`, staff).send({ done: false }).expect(200)).body.done).toBe(false);
});
test("plans persist, can be rescheduled and completed, and remain private even from admin", async () => {
  const { body: plan } = await call("post", "/plans").send({ title: "Coffee", body: "Central cafe", when: future(), owner: bob.id }).expect(201);
  expect((await call("get", "/plans")).body[0]).toMatchObject({ id: plan.id, title: "Coffee" });
  for (const other of [bob, staff, admin]) {
    expect((await call("get", "/plans", other)).body).toEqual([]);
    await call("patch", `/${plan.id}`, other).send({ done: true }).expect(404);
    await call("delete", `/${plan.id}`, other).expect(404);
  }
  expect((await call("patch", `/${plan.id}`).send({ title: "Dinner", body: "New place", when: future(), owner: bob.id }).expect(200)).body.title).toBe("Dinner");
  expect((await call("patch", `/${plan.id}`).send({ done: true }).expect(200)).body.done).toBe(true);
  await call("delete", `/${plan.id}`).expect(204);
  expect(await Entry.countDocuments()).toBe(0);
});
test.each([
  { title: "", when: "tomorrow" }, { title: "Date", when: "bad" },
  { title: "Date", when: "2000-01-01" }, { title: "x".repeat(121), when: "2100-01-01" },
  { title: "Date", body: "x".repeat(2001), when: "2100-01-01" },
  { title: { value: "bad" }, when: "2100-01-01" },
])("invalid plan input is rejected %#", async payload => {
  await call("post", "/plans").send(payload).expect(400);
  expect(await Entry.countDocuments()).toBe(0);
});
test("invalid IDs, audiences, and note completion payloads fail cleanly", async () => {
  await call("patch", "/bad").send({ done: true }).expect(400);
  await call("delete", "/bad").expect(400);
  await call("post", "/announcements", admin).send({ title: "Hello", audience: "admins" }).expect(400);
  await call("post", "/notes", staff).send({ title: "Note", member: "bad" }).expect(400);
  const note = (await call("post", "/notes", staff).send({ title: "Note", member: bob.id })).body;
  await call("patch", `/${note.id}`, staff).send({ done: "yes" }).expect(400);
});
