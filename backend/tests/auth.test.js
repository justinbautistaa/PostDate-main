/**
 * Security-focused test suite for the auth flow, plus requireAuth /
 * requireRole middleware.
 *
 * Uses mongodb-memory-server so this runs against a real, throwaway Mongo
 * instance — no live database needed, and nothing here touches real data.
 *
 * Run with: npm test
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
const { codeHash } = require("../utils/verification");
jest.mock("../utils/verification", () => ({
  ...jest.requireActual("../utils/verification"), emailCode: jest.fn().mockResolvedValue(undefined),
}));
process.env.MAIL_API_KEY = "test-mail-key";
process.env.MAIL_FROM = "test@example.com";

async function verifyTestAccount(email) {
  await request(app).post("/api/verify/send").send({ email }).expect(200);
  const delivery = require("../utils/verification").emailCode.mock.calls.findLast((args) => args[0] === email);
  await request(app).post("/api/verify/confirm").send({ email, code: delivery[1] }).expect(200);
}

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-production-12345";


let mongod;
let app;
let User;

const VALID_SIGNUP = {
  privacyConsent: true,
  firstName: "Test",
  lastName: "User",
  email: "test.user@example.com",
  password: "SuperSecret123",
  birthdate: "1998-05-14", // ISO — matches the <input type="date"> fix
  gender: "female",
  bio: "Hi",
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);

  User = require("../models/User");
  app = require("../server").createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

afterEach(async () => {
  await require("../models/RequestBucket").deleteMany({});
  await User.deleteMany({});
  await require("../models/Profile").deleteMany({});
  jest.clearAllMocks();
});

describe("POST /api/signup", () => {
  test("hashes the password — never stores it in plain text", async () => {
    await request(app).post("/api/signup").send(VALID_SIGNUP).expect(201);
    const stored = await User.findOne({ email: VALID_SIGNUP.email }).select("+passwordHash");
    expect(stored.passwordHash).toBeDefined();
    expect(stored.passwordHash).not.toBe(VALID_SIGNUP.password);
    expect(stored.passwordHash.startsWith("$2")).toBe(true); // bcrypt hash prefix
  });

  test("rejects a duplicate email with 409", async () => {
    await request(app).post("/api/signup").send(VALID_SIGNUP).expect(201);
    const res = await request(app).post("/api/signup").send(VALID_SIGNUP);
    expect(res.status).toBe(409);
  });

  test("rejects a password under 8 characters", async () => {
    const res = await request(app)
      .post("/api/signup")
      .send({ ...VALID_SIGNUP, email: "short@example.com", password: "short" });
    expect(res.status).toBe(400);
  });

  test("rejects signups under 18", async () => {
    const today = new Date();
    const under18 = `${today.getFullYear() - 10}-01-01`;
    const res = await request(app)
      .post("/api/signup")
      .send({ ...VALID_SIGNUP, email: "young@example.com", birthdate: under18 });
    expect(res.status).toBe(400);
  });

  test("rejects a malformed email", async () => {
    const res = await request(app)
      .post("/api/signup")
      .send({ ...VALID_SIGNUP, email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  async function signupAndVerify(email = VALID_SIGNUP.email) {
    await request(app).post("/api/signup").send({ ...VALID_SIGNUP, email });
    await verifyTestAccount(email);
  }

  test("blocks login before email verification with 403", async () => {
    await request(app).post("/api/signup").send(VALID_SIGNUP);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID_SIGNUP.email, password: VALID_SIGNUP.password });
    expect(res.status).toBe(403);
  });

  test("logs in using an HttpOnly cookie after verification", async () => {
    await signupAndVerify();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID_SIGNUP.email, password: VALID_SIGNUP.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    const cookie = res.headers["set-cookie"][0];
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    const decoded = jwt.verify(cookie.split(";")[0].split("=")[1], process.env.JWT_SECRET);
    expect(decoded.userId).toBeDefined();
  });

  test("gives the same error for a wrong password as a nonexistent email", async () => {
    await signupAndVerify();
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID_SIGNUP.email, password: "WrongPassword1" });
    const noSuchUser = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "WrongPassword1" });
    expect(wrongPassword.status).toBe(401);
    expect(noSuchUser.status).toBe(401);
    expect(wrongPassword.body.message).toBe(noSuchUser.body.message);
  });
});

describe("Protected routes (requireAuth / requireRole)", () => {
  async function getToken(role = "user") {
    const email = `${role}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
    await request(app).post("/api/signup").send({ ...VALID_SIGNUP, email });
    await verifyTestAccount(email);
    if (role !== "user") {
      await User.updateOne({ email }, { role });
    }
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: VALID_SIGNUP.password });
    return login.headers["set-cookie"][0].split(";")[0];
  }

  test("rejects /api/profile/me with no token", async () => {
    const res = await request(app).get("/api/profile/me");
    expect(res.status).toBe(401);
  });

  test("rejects a garbage token", async () => {
    const res = await request(app)
      .get("/api/profile/me")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  test("allows /api/profile/me with a valid token", async () => {
    const token = await getToken("user");
    const res = await request(app)
      .get("/api/profile/me")
      .set("Cookie", token);
    expect(res.status).toBe(200);
  });

  test("blocks a regular user from an admin-only route with 403", async () => {
    const token = await getToken("user");
    const res = await request(app)
      .get("/api/admin/ping")
      .set("Cookie", token);
    expect(res.status).toBe(403);
  });

  test("allows an admin through the same route", async () => {
    const token = await getToken("admin");
    const res = await request(app)
      .get("/api/admin/ping")
      .set("Cookie", token);
    expect(res.status).toBe(200);
  });
});

describe("Error handling", () => {
  test("unknown routes return 404, not a stack trace", async () => {
    const res = await request(app).get("/api/this-route-does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.message).toBeDefined();
  });

  test("server errors never leak internals to the client", async () => {
    // malformed JSON body -> body-parser throws -> our error handler
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{not valid json");
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.message).not.toMatch(/at Object|node_modules|\.js:\d+/);
  });
});


describe("Verification abuse resistance", () => {
  const email = VALID_SIGNUP.email;
  beforeEach(async () => { await request(app).post("/api/signup").send(VALID_SIGNUP).expect(201); });
  test("the old universal code cannot verify an account", async () => {
    await request(app).post("/api/verify/confirm").send({ email, code: "0000" }).expect(400);
    expect((await User.findOne({ email })).isVerified).toBe(false);
  });
  test("rejects codes that were never issued", async () => {
    const res = await request(app).post("/api/verify/confirm").send({ email, code: "123456" });
    expect(res.body.verified).toBe(false);
  });
  test("an issued code is hashed, expires, and can only be used once", async () => {
    await request(app).post("/api/verify/send").send({ email }).expect(200);
    const code = require("../utils/verification").emailCode.mock.calls[0][1];
    const user = await User.findOne({ email }).select("+verificationHash +verificationExpiresAt");
    expect(user.verificationHash).toBe(codeHash(email, code));
    expect(user.verificationHash).not.toBe(code);
    expect(user.verificationExpiresAt.getTime()).toBeGreaterThan(Date.now());
    expect((await request(app).post("/api/verify/confirm").send({ email, code })).body.verified).toBe(true);
    expect((await request(app).post("/api/verify/confirm").send({ email, code })).body.verified).toBe(false);
  });
  test("expired codes fail", async () => {
    await User.updateOne({ email }, { verificationHash: codeHash(email, "123456"), verificationExpiresAt: new Date(Date.now() - 1000) });
    expect((await request(app).post("/api/verify/confirm").send({ email, code: "123456" })).body.verified).toBe(false);
  });
  test("five wrong guesses exhaust the code, including concurrent guesses", async () => {
    await User.updateOne({ email }, { verificationHash: codeHash(email, "123456"), verificationExpiresAt: new Date(Date.now() + 60000) });
    await Promise.all(Array.from({ length: 8 }, () => request(app).post("/api/verify/confirm").send({ email, code: "999999" })));
    expect((await request(app).post("/api/verify/confirm").send({ email, code: "123456" })).body.verified).toBe(false);
    expect((await User.findOne({ email }).select("+verificationAttempts")).verificationAttempts).toBe(5);
  });
  test("repeated send requests do not spam an account", async () => {
    await request(app).post("/api/verify/send").send({ email }).expect(200);
    await request(app).post("/api/verify/send").send({ email }).expect(200);
    expect(require("../utils/verification").emailCode).toHaveBeenCalledTimes(1);
  });
  test("resending invalidates the preceding code", async () => {
    await User.updateOne({ email }, { verificationHash: codeHash(email, "old-code"), verificationExpiresAt: new Date(Date.now() + 60000) });
    await request(app).post("/api/verify/send").send({ email }).expect(200);
    expect((await User.findOne({ email }).select("+verificationHash")).verificationHash).not.toBe(codeHash(email, "old-code"));
  });
});

describe("Session security", () => {
  async function cookieLogin() {
    await request(app).post("/api/signup").send(VALID_SIGNUP).expect(201);
    await verifyTestAccount(VALID_SIGNUP.email);
    const res = await request(app).post("/api/auth/login").send({ email: VALID_SIGNUP.email, password: VALID_SIGNUP.password }).expect(200);
    return res.headers["set-cookie"][0].split(";")[0];
  }
  test("logout revokes captured credentials on the server", async () => {
    const cookie = await cookieLogin();
    await request(app).get("/api/auth/session").set("Cookie", cookie).expect(200);
    await request(app).post("/api/auth/logout").set("Cookie", cookie).expect(200);
    await request(app).get("/api/auth/session").set("Cookie", cookie).expect(401);
  });
  test("unverified accounts cannot use an otherwise valid session", async () => {
    const cookie = await cookieLogin();
    await User.updateOne({ email: VALID_SIGNUP.email }, { isVerified: false });
    await request(app).get("/api/auth/session").set("Cookie", cookie).expect(401);
  });
  test("private account responses do not include auth secrets", async () => {
    const cookie = await cookieLogin();
    const res = await request(app).get("/api/profile/me").set("Cookie", cookie).expect(200);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|verificationHash|sessionVersion/);
  });
  test("signup cannot assign admin rights or verification", async () => {
    await request(app).post("/api/signup").send({ ...VALID_SIGNUP, role: "admin", isVerified: true }).expect(201);
    const user = await User.findOne({ email: VALID_SIGNUP.email });
    expect(user.role).toBe("user");
    expect(user.isVerified).toBe(false);
  });
  test("rejects passwords that bcrypt would truncate", async () => {
    await request(app).post("/api/signup").send({ ...VALID_SIGNUP, password: "x".repeat(73) }).expect(400);
  });
  test("own-profile mutations ignore a supplied foreign user ID", async () => {
    const cookie = await cookieLogin();
    const Profile = require("../models/Profile");
    const foreign = await User.create({ email: "foreign@example.com", firstName: "Other", lastName: "Member", passwordHash: "unused" });
    await Profile.create({ userId: foreign._id, dateOfBirth: new Date("1990-01-01"), gender: "female", lookingFor: { intents: ["New friends"] } });
    await request(app).put("/api/profile/looking-for").set("Cookie", cookie)
      .send({ lookingFor: [], userId: foreign._id }).expect(200);
    expect((await Profile.findOne({ userId: foreign._id })).lookingFor.intents).toEqual(["New friends"]);
  });
});


test("legacy universal-code verification does not grant member access", async () => {
  await request(app).post("/api/signup").send(VALID_SIGNUP).expect(201);
  await User.updateOne({ email: VALID_SIGNUP.email }, { isVerified: true });
  await request(app).post("/api/auth/login").send({ email: VALID_SIGNUP.email, password: VALID_SIGNUP.password }).expect(403);
  await verifyTestAccount(VALID_SIGNUP.email);
  await request(app).post("/api/auth/login").send({ email: VALID_SIGNUP.email, password: VALID_SIGNUP.password }).expect(200);
});


test.each([
  { algorithm: "HS256", expiresIn: "1h", issuer: "foreign", audience: "postdate-web" },
  { algorithm: "HS256", expiresIn: "1h", issuer: "postdate", audience: "foreign" },
  { algorithm: "HS256", expiresIn: -1, issuer: "postdate", audience: "postdate-web" },
  { algorithm: "HS384", expiresIn: "1h", issuer: "postdate", audience: "postdate-web" },
])("rejects incompatible or expired session claims: %j", async (options) => {
  const token = jwt.sign({ userId: new mongoose.Types.ObjectId().toString(), version: 0 }, process.env.JWT_SECRET, options);
  await request(app).get("/api/auth/session").set("Cookie", `postdate=${token}`).expect(401);
});

test("concurrent uploads cannot exceed the account photo quota", async () => {
  await request(app).post("/api/signup").send(VALID_SIGNUP).expect(201);
  await verifyTestAccount(VALID_SIGNUP.email);
  const login = await request(app).post("/api/auth/login").send({ email: VALID_SIGNUP.email, password: VALID_SIGNUP.password });
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  const user = await User.findOne({ email: VALID_SIGNUP.email });
  const Profile = require("../models/Profile");
  const fixtures = Array.from({ length: 29 }, (_, i) => `/uploads/fixture-${i}.webp`);
  await Profile.updateOne({ userId: user._id }, { photos: fixtures, avatar: fixtures[0] });
  const png = await require("sharp")({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
  try {
    const responses = await Promise.all([0, 1].map(() => request(app).post("/api/profile/photos")
      .set("Cookie", cookie).attach("photos", png, { filename: "photo.png", contentType: "image/png" })));
    expect(responses.filter(res => res.status === 201)).toHaveLength(1);
    const denied = responses.find(res => res.status !== 201);
    // The shared memory guard can reject before the gallery quota is read.
    // If the first request finishes sooner, the atomic quota returns 409.
    expect([409, 503]).toContain(denied.status);
    if (denied.status === 503) expect(denied.headers['retry-after']).toBe('5');
    expect((await Profile.findOne({ userId: user._id })).photos).toHaveLength(30);
    await request(app).post('/api/profile/photos').set('Cookie', cookie)
      .attach('photos', png, { filename: 'retry.png', contentType: 'image/png' }).expect(400);
  } finally {
    const profile = await Profile.findOne({ userId: user._id });
    await Promise.all(profile.photos.filter((photo) => !fixtures.includes(photo)).map(require("../utils/photoStorage").deletePhotoFile));
  }
});
