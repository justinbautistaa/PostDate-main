/**
 * Security-focused tests for the staff dashboard API.
 *
 * What's being proved here, in the order the "security tests" line of the
 * requirements checklist would want it:
 *   1. every /api/admin route refuses anonymous callers (401) and ordinary
 *      members (403), and admin-only routes also refuse moderators
 *   2. the server enforces who may act on whom, whatever the UI shows
 *   3. input is validated (ids, reasons, statuses, query operators)
 *   4. suspensions take effect on the very next request
 *   5. every state change leaves an audit entry
 *   6. moderators get masked emails
 *
 * Uses mongodb-memory-server like auth.test.js — a real throwaway Mongo, no
 * live database. Run with: npm test
 */
const supertest = require("supertest");
const request = (app) => {
  const agent = supertest(app);
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const original = agent[method].bind(agent);
    agent[method] = (...args) => original(...args).set("X-Postdate-Request", "1");
  }
  return agent;
};
jest.setTimeout(120000);
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-production-12345";

let mongod;
let app;
let User;
let Report;
let Rating;
let Appeal;
let AuditLog;
let Message;

const PASSWORD = "SuperSecret123";

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);

  User = require("../models/User");
  Report = require("../models/Report");
  Rating = require("../models/Rating");
  Appeal = require("../models/Appeal");
  AuditLog = require("../models/AuditLog");
  Message = require("../models/Message");
  await Appeal.init();
  app = require("../server").createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Report.deleteMany({}),
    Rating.deleteMany({}),
    Appeal.deleteMany({}),
    AuditLog.deleteMany({}),
    Message.deleteMany({}),
  ]);
});

/* ── helpers ─────────────────────────────────────────────────────────────── */

let counter = 0;
async function makeUser({ role = "user", firstName = "Test", lastName, email, verified = true } = {}) {
  counter += 1;
  return User.create({
    email: email || `${role}${counter}@example.com`,
    passwordHash: await bcrypt.hash(PASSWORD, 4), // low cost: speed matters in tests
    firstName,
    lastName: lastName || `Person${counter}`,
    role,
    isVerified: verified,
    emailVerifiedAt: verified ? new Date() : null,
  });
}

const tokenFor = (user) =>
  jwt.sign({ userId: user._id, version: user.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "1h", issuer: "postdate", audience: "postdate-web" });

const as = (user) => ({ Cookie: `postdate=${tokenFor(user)}` });

async function makeRating(reviewer, reviewed, overall = 4, comment = "Nice evening") {
  return Rating.create({
    reviewerId: reviewer._id,
    reviewedUserId: reviewed._id,
    matchId: new mongoose.Types.ObjectId(),
    ratings: { overall, spice: overall, attentiveness: overall, respectfulness: overall, chemistry: overall },
    comment,
  });
}

const STAFF_GETS = [
  "/api/admin/overview",
  "/api/admin/statistics",
  "/api/admin/users",
  "/api/admin/reports",
  "/api/admin/ratings",
  "/api/admin/appeals",
];

/* ── 1. who gets in ──────────────────────────────────────────────────────── */

describe("access control", () => {
  test("admin team filter lists staff while moderators remain limited to members", async () => {
    const admin = await makeUser({ role: "admin" });
    const mod = await makeUser({ role: "moderator" });
    await makeUser();
    const team = await request(app).get("/api/admin/users?team=true").set(as(admin));
    expect(team.body.rows).toHaveLength(2);
    expect(team.body.rows.every(row => ["admin", "moderator"].includes(row.role))).toBe(true);
    const memberOnly = await request(app).get("/api/admin/users?team=true&role=admin").set(as(mod));
    expect(memberOnly.body.rows).toHaveLength(1);
    expect(memberOnly.body.rows[0].role).toBe("user");
  });
  test.each([...STAFF_GETS, "/api/admin/activity"])("%s rejects a request with no token (401)", async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(401);
  });

  test.each([...STAFF_GETS, "/api/admin/activity"])("%s rejects an ordinary member (403)", async (url) => {
    const member = await makeUser();
    const res = await request(app).get(url).set(as(member));
    expect(res.status).toBe(403);
  });

  test.each(STAFF_GETS)("%s lets a moderator in", async (url) => {
    const mod = await makeUser({ role: "moderator" });
    const res = await request(app).get(url).set(as(mod));
    expect(res.status).toBe(200);
  });

  test("the activity log is admin-only: a moderator gets 403", async () => {
    const mod = await makeUser({ role: "moderator" });
    const res = await request(app).get("/api/admin/activity").set(as(mod));
    expect(res.status).toBe(403);
  });

  test("an admin can read the activity log", async () => {
    const admin = await makeUser({ role: "admin" });
    const res = await request(app).get("/api/admin/activity").set(as(admin));
    expect(res.status).toBe(200);
    expect(res.body.summary.perDay).toHaveLength(14);
  });

  test("changing a role is admin-only: a moderator gets 403", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await makeUser();
    const res = await request(app)
      .patch(`/api/admin/users/${member._id}/role`)
      .set(as(mod))
      .send({ role: "moderator" });
    expect(res.status).toBe(403);
    expect((await User.findById(member._id)).role).toBe("user");
  });

  test("a token for a demoted admin stops working as admin straight away", async () => {
    const admin = await makeUser({ role: "admin" });
    const token = tokenFor(admin); // minted while still an admin
    await User.updateOne({ _id: admin._id }, { role: "user" });
    const res = await request(app).get("/api/admin/users").set("Cookie", `postdate=${token}`);
    expect(res.status).toBe(403);
  });
});

/* ── users: listing, privacy, input handling ─────────────────────────────── */

describe("GET /api/admin/users", () => {
  test("moderators see masked emails, admins see the real one", async () => {
    const mod = await makeUser({ role: "moderator" });
    const admin = await makeUser({ role: "admin" });
    await makeUser({ firstName: "Jane", lastName: "Doe", email: "jane.doe@example.com" });

    const asMod = await request(app).get("/api/admin/users?q=jane").set(as(mod));
    const asAdmin = await request(app).get("/api/admin/users?q=jane").set(as(admin));

    expect(asMod.body.rows[0].email).toMatch(/^j\*+@example\.com$/);
    expect(asAdmin.body.rows[0].email).toBe("jane.doe@example.com");
  });

  test("a moderator can't probe for an email address by searching it", async () => {
    const mod = await makeUser({ role: "moderator" });
    const admin = await makeUser({ role: "admin" });
    await makeUser({ firstName: "Jane", lastName: "Doe", email: "jane.doe@example.com" });

    const asMod = await request(app).get("/api/admin/users?q=jane.doe@example.com").set(as(mod));
    const asAdmin = await request(app).get("/api/admin/users?q=jane.doe@example.com").set(as(admin));

    expect(asMod.body.rows).toHaveLength(0);
    expect(asAdmin.body.rows).toHaveLength(1);
  });

  test("searches by full name", async () => {
    const mod = await makeUser({ role: "moderator" });
    await makeUser({ firstName: "Jane", lastName: "Doe" });
    await makeUser({ firstName: "Janet", lastName: "Smith" });
    const res = await request(app).get("/api/admin/users?q=jane%20doe").set(as(mod));
    expect(res.body.rows.map((r) => r.name)).toEqual(["Jane Doe"]);
  });

  test("a query-operator object in ?q is ignored, not executed", async () => {
    const mod = await makeUser({ role: "moderator" });
    await makeUser();
    const res = await request(app).get("/api/admin/users?q[$ne]=zzz").set(as(mod));
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBeGreaterThan(0); // no filter applied, nothing exploded
  });

  test("regex characters in the search box are treated as plain text", async () => {
    const mod = await makeUser({ role: "moderator" });
    await makeUser({ firstName: "Jane", lastName: "Doe" });
    const res = await request(app).get("/api/admin/users?q=.*").set(as(mod));
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(0); // ".*" must not match everyone
  });

  test("paginates and clamps absurd page sizes", async () => {
    const mod = await makeUser({ role: "moderator" });
    for (let i = 0; i < 5; i += 1) await makeUser();
    const res = await request(app).get("/api/admin/users?limit=2&page=2").set(as(mod));
    expect(res.body.rows).toHaveLength(2);
    expect(res.body.total).toBe(5);
    expect(res.body.pages).toBe(3);
    const huge = await request(app).get("/api/admin/users?limit=99999").set(as(mod));
    expect(huge.body.limit).toBeLessThanOrEqual(50);
  });

  test("each row says what the viewer may do to it", async () => {
    const mod = await makeUser({ role: "moderator" });
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser();
    const res = await request(app).get("/api/admin/users").set(as(mod));
    const byId = Object.fromEntries(res.body.rows.map((r) => [r.id, r]));
    expect(byId[String(member._id)].can.suspend).toBe(true);
    expect(byId[String(admin._id)]).toBeUndefined();
    expect(byId[String(mod._id)]).toBeUndefined();
    const filtered = await request(app).get("/api/admin/users?role=admin").set(as(mod));
    expect(filtered.body.rows.every(row => row.role === "user")).toBe(true);
  });
});

/* ── users: suspending, reinstating, roles ───────────────────────────────── */

describe("suspending and reinstating", () => {
  test("a reason is required to suspend", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await makeUser();
    const res = await request(app).post(`/api/admin/users/${member._id}/suspend`).set(as(mod)).send({});
    expect(res.status).toBe(400);
    expect((await User.findById(member._id)).isActive).toBe(true);
  });

  test("suspending records who, when and why — and writes an audit entry", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await makeUser();
    const res = await request(app)
      .post(`/api/admin/users/${member._id}/suspend`)
      .set(as(mod))
      .send({ reason: "Harassment confirmed" });
    expect(res.status).toBe(200);

    const stored = await User.findById(member._id);
    expect(stored.isActive).toBe(false);
    expect(stored.suspensionReason).toBe("Harassment confirmed");
    expect(String(stored.suspendedBy)).toBe(String(mod._id));
    expect(stored.suspendedAt).toBeInstanceOf(Date);

    const entries = await AuditLog.find({ action: "user.suspend" });
    expect(entries).toHaveLength(1);
    expect(String(entries[0].actorId)).toBe(String(mod._id));
    expect(String(entries[0].targetId)).toBe(String(member._id));
    expect(entries[0].actorRole).toBe("moderator");
  });

  test("a suspension takes effect on the very next request", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await makeUser();
    const before = await request(app).get("/api/profile/me").set(as(member));
    expect(before.status).toBe(200);

    await request(app).post(`/api/admin/users/${member._id}/suspend`).set(as(mod)).send({ reason: "Fake photos" });

    const after = await request(app).get("/api/profile/me").set(as(member)); // same, still-valid token
    expect(after.status).toBe(401);
  });

  test("a suspended member can't log in", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await makeUser();
    await request(app).post(`/api/admin/users/${member._id}/suspend`).set(as(mod)).send({ reason: "Fake photos" });
    const res = await request(app).post("/api/auth/login").send({ email: member.email, password: PASSWORD });
    expect(res.status).toBe(403);
  });

  test("suspending twice is a 409, not a second audit entry", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await makeUser();
    const url = `/api/admin/users/${member._id}/suspend`;
    await request(app).post(url).set(as(mod)).send({ reason: "Spam links" });
    const again = await request(app).post(url).set(as(mod)).send({ reason: "Spam links" });
    expect(again.status).toBe(409);
    expect(await AuditLog.countDocuments({ action: "user.suspend" })).toBe(1);
  });

  test("nobody can suspend their own account", async () => {
    const admin = await makeUser({ role: "admin" });
    const res = await request(app).post(`/api/admin/users/${admin._id}/suspend`).set(as(admin)).send({ reason: "Oops" });
    expect(res.status).toBe(403);
    expect((await User.findById(admin._id)).isActive).toBe(true);
  });

  test("a moderator can't suspend an admin or another moderator", async () => {
    const mod = await makeUser({ role: "moderator" });
    const otherMod = await makeUser({ role: "moderator" });
    const admin = await makeUser({ role: "admin" });
    for (const target of [admin, otherMod]) {
      const res = await request(app)
        .post(`/api/admin/users/${target._id}/suspend`)
        .set(as(mod))
        .send({ reason: "Power grab" });
      expect(res.status).toBe(403);
      expect((await User.findById(target._id)).isActive).toBe(true);
    }
  });

  test("an admin can suspend a moderator", async () => {
    const admin = await makeUser({ role: "admin" });
    const mod = await makeUser({ role: "moderator" });
    const res = await request(app).post(`/api/admin/users/${mod._id}/suspend`).set(as(admin)).send({ reason: "Misconduct" });
    expect(res.status).toBe(200);
  });

  test("malformed and unknown ids are handled cleanly", async () => {
    const mod = await makeUser({ role: "moderator" });
    const bad = await request(app).post("/api/admin/users/not-an-id/suspend").set(as(mod)).send({ reason: "Whatever" });
    expect(bad.status).toBe(400);
    const twelveChars = await request(app).post("/api/admin/users/aaaaaaaaaaaa/suspend").set(as(mod)).send({ reason: "Whatever" });
    expect(twelveChars.status).toBe(400); // mongoose.isValidObjectId would have let this through
    const unknown = await request(app)
      .post(`/api/admin/users/${new mongoose.Types.ObjectId()}/suspend`)
      .set(as(mod))
      .send({ reason: "Whatever" });
    expect(unknown.status).toBe(404);
  });

  test("reinstating puts the member back and logs it", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await makeUser();
    await request(app).post(`/api/admin/users/${member._id}/suspend`).set(as(mod)).send({ reason: "Fake photos" });

    const res = await request(app).post(`/api/admin/users/${member._id}/reinstate`).set(as(mod));
    expect(res.status).toBe(200);

    const stored = await User.findById(member._id);
    expect(stored.isActive).toBe(true);
    expect(stored.suspensionReason).toBe("");
    expect(await AuditLog.countDocuments({ action: "user.reinstate" })).toBe(1);

    const login = await request(app).post("/api/auth/login").send({ email: member.email, password: PASSWORD });
    expect(login.status).toBe(200);
  });

  test("reinstating someone who isn't suspended is a 409", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await makeUser();
    const res = await request(app).post(`/api/admin/users/${member._id}/reinstate`).set(as(mod));
    expect(res.status).toBe(409);
  });

  test("reinstating directly also closes that member's waiting appeal", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await makeUser();
    await request(app).post(`/api/admin/users/${member._id}/suspend`).set(as(mod)).send({ reason: "Fake photos" });
    await request(app).post("/api/appeals").send({ email: member.email, password: PASSWORD, message: "Please look again, this was a mistake." });

    await request(app).post(`/api/admin/users/${member._id}/reinstate`).set(as(mod));
    const appeal = await Appeal.findOne({ userId: member._id });
    expect(appeal.status).toBe("approved");
  });
});

describe("changing roles", () => {
  test("an admin can promote a member and it's logged", async () => {
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser();
    const res = await request(app).patch(`/api/admin/users/${member._id}/role`).set(as(admin)).send({ role: "moderator" });
    expect(res.status).toBe(200);
    expect((await User.findById(member._id)).role).toBe("moderator");
    const entry = await AuditLog.findOne({ action: "user.role_change" });
    expect(entry.details).toEqual({ from: "user", to: "moderator" });
  });

  test("an unknown role is rejected", async () => {
    const admin = await makeUser({ role: "admin" });
    const member = await makeUser();
    const res = await request(app).patch(`/api/admin/users/${member._id}/role`).set(as(admin)).send({ role: "superuser" });
    expect(res.status).toBe(400);
  });

  test("an admin can't change their own role", async () => {
    const admin = await makeUser({ role: "admin" });
    const res = await request(app).patch(`/api/admin/users/${admin._id}/role`).set(as(admin)).send({ role: "user" });
    expect(res.status).toBe(403);
    expect((await User.findById(admin._id)).role).toBe("admin");
    await request(app).patch(`/api/admin/users/${String(admin._id).toUpperCase()}/role`)
      .set(as(admin)).send({ role: "user" }).expect(403);
    expect((await User.findById(admin._id)).role).toBe("admin");
  });
});

/* ── reports ─────────────────────────────────────────────────────────────── */

describe("reports", () => {
  async function fileReport(reporter, target, body = {}) {
    return request(app)
      .post("/api/reports")
      .set(as(reporter))
      .send({ targetType: "user", targetId: String(target._id), reason: "Harassment", description: "Kept messaging me.", ...body });
  }

  test("a signed-in member can file a report; staff then see it", async () => {
    const reporter = await makeUser({ firstName: "Priya", lastName: "Nair" });
    const reported = await makeUser({ firstName: "Marcus", lastName: "Tate" });
    const mod = await makeUser({ role: "moderator" });

    const filed = await fileReport(reporter, reported);
    expect(filed.status).toBe(201);

    const list = await request(app).get("/api/admin/reports?status=pending").set(as(mod));
    expect(list.body.counts.pending).toBe(1);
    const row = list.body.rows[0];
    expect(row.reporter.name).toBe("Priya Nair");
    expect(row.reportedUser.name).toBe("Marcus Tate");
    expect(row.reason).toBe("Harassment");
    expect(row.can.suspendReported).toBe(true);
  });

  test("filing a report needs a login", async () => {
    const reported = await makeUser();
    const res = await request(app).post("/api/reports").send({ targetType: "user", targetId: String(reported._id), reason: "Harassment" });
    expect(res.status).toBe(401);
  });

  test("rejects a reason that isn't on the list", async () => {
    const reporter = await makeUser();
    const reported = await makeUser();
    const res = await fileReport(reporter, reported, { reason: "I just don't like him" });
    expect(res.status).toBe(400);
  });

  test("rejects a malformed target id", async () => {
    const reporter = await makeUser();
    const res = await request(app).post("/api/reports").set(as(reporter)).send({ targetType: "user", targetId: "nope", reason: "Harassment" });
    expect(res.status).toBe(400);
  });

  test("you can't report yourself", async () => {
    const me = await makeUser();
    const res = await fileReport(me, me);
    expect(res.status).toBe(400);
  });

  test("reporting someone who doesn't exist is a 404", async () => {
    const reporter = await makeUser();
    const res = await fileReport(reporter, { _id: new mongoose.Types.ObjectId() });
    expect(res.status).toBe(404);
  });

  test("the same open report can't be filed twice", async () => {
    const reporter = await makeUser();
    const reported = await makeUser();
    await fileReport(reporter, reported);
    const again = await fileReport(reporter, reported);
    expect(again.status).toBe(409);
  });

  test("you can only report a message from a conversation you were in", async () => {
    const sender = await makeUser();
    const receiver = await makeUser();
    const stranger = await makeUser();
    const message = await Message.create({ matchId: new mongoose.Types.ObjectId(), senderId: sender._id, receiverId: receiver._id, message: "hello" });

    const asStranger = await request(app).post("/api/reports").set(as(stranger)).send({ targetType: "message", targetId: String(message._id), reason: "Harassment" });
    expect(asStranger.status).toBe(404);

    const asReceiver = await request(app).post("/api/reports").set(as(receiver)).send({ targetType: "message", targetId: String(message._id), reason: "Harassment" });
    expect(asReceiver.status).toBe(201);
    const stored = await Report.findOne({ targetType: "message" });
    expect(String(stored.reportedUserId)).toBe(String(sender._id)); // the author, not the message id
  });

  test("a moderator can resolve a report with a note; it's stamped and logged", async () => {
    const reporter = await makeUser();
    const reported = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    const { body } = await fileReport(reporter, reported);

    const res = await request(app).patch(`/api/admin/reports/${body.id}`).set(as(mod)).send({ status: "resolved", note: "Confirmed in chat logs" });
    expect(res.status).toBe(200);

    const stored = await Report.findById(body.id);
    expect(stored.status).toBe("resolved");
    expect(stored.resolutionNote).toBe("Confirmed in chat logs");
    expect(String(stored.resolvedBy)).toBe(String(mod._id));
    expect(stored.resolvedAt).toBeInstanceOf(Date);
    expect(await AuditLog.countDocuments({ action: "report.update" })).toBe(1);
  });

  test("an unknown status is rejected", async () => {
    const mod = await makeUser({ role: "moderator" });
    const reporter = await makeUser();
    const reported = await makeUser();
    const { body } = await fileReport(reporter, reported);
    const res = await request(app).patch(`/api/admin/reports/${body.id}`).set(as(mod)).send({ status: "deleted" });
    expect(res.status).toBe(400);
  });

  test("reopening clears the handler and the closed-at time", async () => {
    const mod = await makeUser({ role: "moderator" });
    const reporter = await makeUser();
    const reported = await makeUser();
    const { body } = await fileReport(reporter, reported);
    const url = `/api/admin/reports/${body.id}`;
    await request(app).patch(url).set(as(mod)).send({ status: "dismissed", note: "Not enough" });
    await request(app).patch(url).set(as(mod)).send({ status: "pending" });
    const stored = await Report.findById(body.id);
    expect(stored.status).toBe("pending");
    expect(stored.resolvedAt).toBeNull();
    expect(stored.resolvedBy).toBeNull();
  });

  test("a moderator isn't offered 'suspend' for a report about an admin", async () => {
    const mod = await makeUser({ role: "moderator" });
    const admin = await makeUser({ role: "admin" });
    const reporter = await makeUser();
    await fileReport(reporter, admin);
    const list = await request(app).get("/api/admin/reports").set(as(mod));
    expect(list.body.rows[0].can.suspendReported).toBe(false);
  });
});

/* ── ratings ─────────────────────────────────────────────────────────────── */

describe("ratings", () => {
  test("hiding needs a reason, and a hidden rating drops out of the average", async () => {
    const mod = await makeUser({ role: "moderator" });
    const a = await makeUser();
    const b = await makeUser();
    const c = await makeUser();
    const good = await makeRating(a, c, 5, "Lovely");
    const rude = await makeRating(b, c, 1, "Awful person, avoid");

    const before = await request(app).get("/api/admin/ratings").set(as(mod));
    expect(before.body.summary.count).toBe(2);
    expect(before.body.summary.averages.overall).toBe(3);

    const noReason = await request(app).patch(`/api/admin/ratings/${rude._id}`).set(as(mod)).send({ hidden: true });
    expect(noReason.status).toBe(400);

    const hide = await request(app).patch(`/api/admin/ratings/${rude._id}`).set(as(mod)).send({ hidden: true, reason: "Personal insults" });
    expect(hide.status).toBe(200);

    const after = await request(app).get("/api/admin/ratings").set(as(mod));
    expect(after.body.summary.count).toBe(1);
    expect(after.body.summary.averages.overall).toBe(5);
    expect(after.body.counts).toMatchObject({ all: 2, visible: 1, hidden: 1 });
    expect(String(good._id)).toBeTruthy();

    const entry = await AuditLog.findOne({ action: "rating.hide" });
    expect(entry.summary).toMatch(/Personal insults/);
  });

  test("hiding twice is a 409; restoring brings it back", async () => {
    const mod = await makeUser({ role: "moderator" });
    const a = await makeUser();
    const b = await makeUser();
    const rating = await makeRating(a, b, 2);
    const url = `/api/admin/ratings/${rating._id}`;

    await request(app).patch(url).set(as(mod)).send({ hidden: true, reason: "Off topic" });
    const twice = await request(app).patch(url).set(as(mod)).send({ hidden: true, reason: "Off topic" });
    expect(twice.status).toBe(409);

    const restore = await request(app).patch(url).set(as(mod)).send({ hidden: false });
    expect(restore.status).toBe(200);
    const stored = await Rating.findById(rating._id);
    expect(stored.isHidden).toBe(false);
    expect(stored.hiddenBy).toBeNull();
    expect(await AuditLog.countDocuments({ action: "rating.restore" })).toBe(1);
  });

  test("a non-boolean 'hidden' value is a 400", async () => {
    const mod = await makeUser({ role: "moderator" });
    const a = await makeUser();
    const b = await makeUser();
    const rating = await makeRating(a, b);
    const res = await request(app).patch(`/api/admin/ratings/${rating._id}`).set(as(mod)).send({ hidden: "yes", reason: "x y z" });
    expect(res.status).toBe(400);
  });

  test("the low-score and hidden filters work", async () => {
    const mod = await makeUser({ role: "moderator" });
    const a = await makeUser();
    const b = await makeUser();
    const c = await makeUser();
    await makeRating(a, c, 5);
    const low = await makeRating(b, c, 1);
    await Rating.updateOne({ _id: low._id }, { isHidden: true });

    const lowOnly = await request(app).get("/api/admin/ratings?visibility=low").set(as(mod));
    expect(lowOnly.body.rows).toHaveLength(1);
    const hiddenOnly = await request(app).get("/api/admin/ratings?visibility=hidden").set(as(mod));
    expect(hiddenOnly.body.rows).toHaveLength(1);
    const visibleOnly = await request(app).get("/api/admin/ratings?visibility=visible").set(as(mod));
    expect(visibleOnly.body.rows).toHaveLength(1);
  });
});

/* ── appeals ─────────────────────────────────────────────────────────────── */

describe("appeals", () => {
  const MESSAGE = "I think this was a mistake, please look again.";

  async function suspended(by) {
    const member = await makeUser({ firstName: "Dana", lastName: "Reyes" });
    await request(app).post(`/api/admin/users/${member._id}/suspend`).set(as(by)).send({ reason: "Fake photos" });
    return member;
  }

  test("a suspended member can appeal with their credentials", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await suspended(mod);
    const res = await request(app).post("/api/appeals").send({ email: member.email, password: PASSWORD, message: MESSAGE });
    expect(res.status).toBe(201);
    expect(await Appeal.countDocuments({ status: "pending" })).toBe(1);
  });

  test("a wrong password and an unknown email get the same 401", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await suspended(mod);
    const wrongPassword = await request(app).post("/api/appeals").send({ email: member.email, password: "Nope-Nope-123", message: MESSAGE });
    const unknownEmail = await request(app).post("/api/appeals").send({ email: "nobody@example.com", password: "Nope-Nope-123", message: MESSAGE });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  test("an account that isn't suspended can't appeal", async () => {
    const member = await makeUser();
    const res = await request(app).post("/api/appeals").send({ email: member.email, password: PASSWORD, message: MESSAGE });
    expect(res.status).toBe(400);
  });

  test("too-short messages and second open appeals are refused", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await suspended(mod);
    const short = await request(app).post("/api/appeals").send({ email: member.email, password: PASSWORD, message: "pls" });
    expect(short.status).toBe(400);

    await request(app).post("/api/appeals").send({ email: member.email, password: PASSWORD, message: MESSAGE });
    const again = await request(app).post("/api/appeals").send({ email: member.email, password: PASSWORD, message: MESSAGE });
    expect(again.status).toBe(409);
  });

  test("approving reinstates the member and is logged", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await suspended(mod);
    await request(app).post("/api/appeals").send({ email: member.email, password: PASSWORD, message: MESSAGE });
    const appeal = await Appeal.findOne({ userId: member._id });

    const res = await request(app).post(`/api/admin/appeals/${appeal._id}/decision`).set(as(mod)).send({ decision: "approve" });
    expect(res.status).toBe(200);

    expect((await User.findById(member._id)).isActive).toBe(true);
    expect((await Appeal.findById(appeal._id)).status).toBe("approved");
    expect(await AuditLog.countDocuments({ action: "appeal.approve" })).toBe(1);
  });

  test("denying needs a reason and leaves the member suspended", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await suspended(mod);
    await request(app).post("/api/appeals").send({ email: member.email, password: PASSWORD, message: MESSAGE });
    const appeal = await Appeal.findOne({ userId: member._id });
    const url = `/api/admin/appeals/${appeal._id}/decision`;

    const noNote = await request(app).post(url).set(as(mod)).send({ decision: "deny" });
    expect(noNote.status).toBe(400);

    const denied = await request(app).post(url).set(as(mod)).send({ decision: "deny", note: "Evidence is clear" });
    expect(denied.status).toBe(200);
    expect((await User.findById(member._id)).isActive).toBe(false);
    expect((await Appeal.findById(appeal._id)).decisionNote).toBe("Evidence is clear");
  });

  test("an appeal can only be decided once", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await suspended(mod);
    await request(app).post("/api/appeals").send({ email: member.email, password: PASSWORD, message: MESSAGE });
    const appeal = await Appeal.findOne({ userId: member._id });
    const url = `/api/admin/appeals/${appeal._id}/decision`;
    await request(app).post(url).set(as(mod)).send({ decision: "approve" });
    const second = await request(app).post(url).set(as(mod)).send({ decision: "deny", note: "Changed my mind" });
    expect(second.status).toBe(409);
  });

  test("a moderator can't decide an appeal from a suspended moderator, but an admin can", async () => {
    const admin = await makeUser({ role: "admin" });
    const mod = await makeUser({ role: "moderator" });
    const otherMod = await makeUser({ role: "moderator" });
    await request(app).post(`/api/admin/users/${otherMod._id}/suspend`).set(as(admin)).send({ reason: "Misconduct" });
    await request(app).post("/api/appeals").send({ email: otherMod.email, password: PASSWORD, message: MESSAGE });
    const appeal = await Appeal.findOne({ userId: otherMod._id });
    const url = `/api/admin/appeals/${appeal._id}/decision`;

    const asMod = await request(app).post(url).set(as(mod)).send({ decision: "approve" });
    expect(asMod.status).toBe(403);
    const asAdmin = await request(app).post(url).set(as(admin)).send({ decision: "approve" });
    expect(asAdmin.status).toBe(200);
  });

  test("the list reports the suspension context and a count per tab", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await suspended(mod);
    await request(app).post("/api/appeals").send({ email: member.email, password: PASSWORD, message: MESSAGE });
    const res = await request(app).get("/api/admin/appeals?status=pending").set(as(mod));
    expect(res.body.counts).toMatchObject({ pending: 1, all: 1 });
    expect(res.body.rows[0].user.suspension.reason).toBe("Fake photos");
    expect(res.body.rows[0].can.decide).toBe(true);
  });
});

/* ── statistics, overview, activity ──────────────────────────────────────── */

describe("statistics and overview", () => {
  test("returns one point per day for the requested range", async () => {
    const mod = await makeUser({ role: "moderator" });
    const week = await request(app).get("/api/admin/statistics?days=7").set(as(mod));
    expect(week.body.range).toBe(7);
    expect(week.body.series.signups).toHaveLength(7);
    expect(week.body.series.matches).toHaveLength(7);
  });

  test("an unsupported range falls back to 30 days", async () => {
    const mod = await makeUser({ role: "moderator" });
    const res = await request(app).get("/api/admin/statistics?days=5").set(as(mod));
    expect(res.body.range).toBe(30);
    expect(res.body.series.signups).toHaveLength(30);
  });

  test("counts members (not staff) and today's signups", async () => {
    const mod = await makeUser({ role: "moderator" });
    await makeUser();
    await makeUser();
    const res = await request(app).get("/api/admin/statistics?days=7").set(as(mod));
    expect(res.body.totals.members).toBe(2);
    expect(res.body.totals.staff).toBe(1);
    const today = res.body.series.signups[res.body.series.signups.length - 1];
    expect(today.count).toBe(2);
  });

  test("overview carries the pending counts the sidebar badges show", async () => {
    const mod = await makeUser({ role: "moderator" });
    const reporter = await makeUser();
    const reported = await makeUser();
    await request(app).post("/api/reports").set(as(reporter)).send({ targetType: "user", targetId: String(reported._id), reason: "Spam or scam" });
    const res = await request(app).get("/api/admin/overview").set(as(mod));
    expect(res.body).toMatchObject({ pendingReports: 1, pendingAppeals: 0 });
  });

  test("a member's authenticated request counts them as active", async () => {
    const mod = await makeUser({ role: "moderator" });
    const member = await makeUser();
    await request(app).get("/api/profile/me").set(as(member));
    await new Promise((resolve) => setTimeout(resolve, 150)); // the activity stamp is fire-and-forget
    const res = await request(app).get("/api/admin/overview").set(as(mod));
    expect(res.body.activeCount).toBe(1); // the moderator themself isn't counted
  });
});

describe("mod activity", () => {
  test("every action shows up, newest first, with who did it", async () => {
    const admin = await makeUser({ role: "admin", firstName: "Ada", lastName: "Root" });
    const mod = await makeUser({ role: "moderator", firstName: "Sam", lastName: "Ng" });
    const member = await makeUser();
    await request(app).post(`/api/admin/users/${member._id}/suspend`).set(as(mod)).send({ reason: "Spam links" });
    await request(app).post(`/api/admin/users/${member._id}/reinstate`).set(as(admin));

    const res = await request(app).get("/api/admin/activity").set(as(admin));
    expect(res.body.rows.map((r) => r.action)).toEqual(["user.reinstate", "user.suspend"]);
    expect(res.body.rows[1].actor.name).toBe("Sam Ng");
    expect(res.body.summary.byActor).toHaveLength(2);
    expect(res.body.summary.perDay).toHaveLength(14);
  });

  test("filters by action and ignores a junk action value", async () => {
    const admin = await makeUser({ role: "admin" });
    const mod = await makeUser({ role: "moderator" });
    const member = await makeUser();
    await request(app).post(`/api/admin/users/${member._id}/suspend`).set(as(mod)).send({ reason: "Spam links" });
    await request(app).post(`/api/admin/users/${member._id}/reinstate`).set(as(mod));

    const only = await request(app).get("/api/admin/activity?action=user.suspend").set(as(admin));
    expect(only.body.rows).toHaveLength(1);
    const junk = await request(app).get("/api/admin/activity?action[$ne]=x").set(as(admin));
    expect(junk.status).toBe(200);
    expect(junk.body.rows).toHaveLength(2);
  });
});


test("suspension permanently revokes prior sessions even after reinstatement", async () => {
  const admin = await makeUser({ role: "admin" });
  const member = await makeUser();
  const oldCookie = as(member);
  await request(app).post(`/api/admin/users/${member._id}/suspend`).set(as(admin)).send({ reason: "Account protection" }).expect(200);
  await request(app).post(`/api/admin/users/${member._id}/reinstate`).set(as(admin)).expect(200);
  await request(app).get("/api/auth/session").set(oldCookie).expect(401);
  await request(app).post("/api/auth/login").send({ email: member.email, password: PASSWORD }).expect(200);
});
