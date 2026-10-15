const request = require("supertest");
const express = require("express");
const sharp = require("sharp");
const fs = require("fs/promises");
const path = require("path");
const { securityMiddleware, validateRequest, validateEnvironment } = require("../middleware/security");
const { errorHandler } = require("../middleware/errorHandler");
const { savePhotosToDisk, deletePhotoFile, UPLOAD_DIR } = require("../utils/photoStorage");
const { setSession } = require("../utils/session");

describe("Request security", () => {
  const app = express();
  app.use(...securityMiddleware());
  app.use(express.json({ limit: "64kb" }));
  app.use(validateRequest);
  app.post("/change", (req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  test("blocks a form submission without a CSRF header", async () => {
    await request(app).post("/change").send({}).expect(403);
  });
  test("blocks an untrusted origin even with the CSRF header", async () => {
    await request(app).post("/change").set("Origin", "https://evil.example")
      .set("X-Postdate-Request", "1").send({}).expect(403);
  });
  test("allows the configured frontend origin and credentials", async () => {
    const res = await request(app).post("/change").set("Origin", "http://localhost:5173")
      .set("X-Postdate-Request", "1").send({}).expect(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
  test.each([{ email: { $ne: null } }, { nested: { "user.role": "admin" } }, JSON.parse('{"__proto__":{"admin":true}}')])(
    "rejects query operator or prototype injection: %j", async (body) => {
      await request(app).post("/change").set("X-Postdate-Request", "1").send(body).expect(400);
    }
  );
  test("limits JSON size", async () => {
    await request(app).post("/change").set("X-Postdate-Request", "1")
      .send({ bio: "x".repeat(70000) }).expect(413);
  });
  test("does not expose malformed request contents in logs or response", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await request(app).post("/change?secret=private-key").set("X-Postdate-Request", "1")
        .set("Content-Type", "application/json").send('{"password":"private-password"').expect(400);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-key|private-password/);
      expect(JSON.stringify(res.body)).not.toMatch(/private-key|private-password/);
    } finally { log.mockRestore(); }
  });
});

describe("Image safety", () => {
  test("rejects script bytes masquerading as an image", async () => {
    await expect(savePhotosToDisk([{ mimetype: "image/png", buffer: Buffer.from("<script>alert(1)</script>") }]))
      .rejects.toMatchObject({ status: 400 });
  });
  test("decodes and re-encodes real image bytes, removes appended payload", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    const photos = await savePhotosToDisk([{ mimetype: "image/png", buffer: Buffer.concat([png, Buffer.from("private-marker")]) }]);
    try {
      expect(photos[0]).toMatch(/^\/uploads\/[a-f0-9]{32}\.webp$/);
      const bytes = await fs.readFile(path.join(UPLOAD_DIR, path.basename(photos[0])));
      expect((await sharp(bytes).metadata()).format).toBe("webp");
      expect(bytes.includes(Buffer.from("private-marker"))).toBe(false);
    } finally { await deletePhotoFile(photos[0]); }
  });
});

describe("Production configuration", () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });
  test("refuses a missing or short signing secret", () => {
    process.env.JWT_SECRET = "weak";
    expect(validateEnvironment).toThrow(/JWT_SECRET/);
  });
  test("refuses production without HTTPS", () => {
    process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-bytes";
    process.env.MONGO_URI = "mongodb://localhost/test";
    process.env.NODE_ENV = "production";
    process.env.CLIENT_URL = "http://localhost:5173";
    expect(validateEnvironment).toThrow(/HTTPS/);
  });
  test("production sessions use Secure, HttpOnly and host-only cookies", () => {
    process.env.JWT_SECRET = "test-secret-longer-than-thirty-two-bytes";
    process.env.NODE_ENV = "production";
    const res = { cookie: jest.fn() };
    setSession(res, { _id: "test-user", sessionVersion: 1 });
    const [name, token, options] = res.cookie.mock.calls[0];
    expect(name).toBe("__Host-postdate");
    expect(options).toMatchObject({ secure: true, httpOnly: true, sameSite: "strict", path: "/" });
    expect(options.domain).toBeUndefined();
  });
});


test("the actual auth limiter blocks after its configured request budget", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  let limiter;
  try { jest.isolateModules(() => { limiter = require("../middleware/rateLimiter").authLimiter; }); }
  finally { process.env.NODE_ENV = previous; }
  const app = express();
  app.post("/login", limiter, (req, res) => res.sendStatus(200));
  for (let i = 0; i < 20; i++) await request(app).post("/login").expect(200);
  await request(app).post("/login").expect(429);
});

test("production denies secret files and unknown webhook endpoints, with CSP", async () => {
  const { createApp } = require("../server");
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const client = process.env.CLIENT_URL;
  process.env.CLIENT_URL = "https://postdate.example";
  try {
    const app = createApp();
    for (const url of ["/.env", "/backend/.env", "/.git/config"]) {
      const res = await request(app).get(url).expect(404);
      expect(res.headers["content-security-policy"]).toMatch(/script-src 'self'/);
      expect(res.headers["x-powered-by"]).toBeUndefined();
    }
    await request(app).post("/api/webhooks/unknown").set("X-Postdate-Request", "1").expect(404);
  } finally {
    process.env.NODE_ENV = previous;
    if (client === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = client;
  }
});
