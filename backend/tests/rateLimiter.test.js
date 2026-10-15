/**
 * Isolated test for the rate-limiting middleware itself, separate from
 * auth.test.js — which relaxes the real auth/general limits in test mode so
 * the rest of that suite doesn't trip them mid-run (see
 * middleware/rateLimiter.js). This spins up a tiny standalone app with its
 * own strict limiter to prove express-rate-limit is wired up correctly.
 */
const request = require("supertest");
const express = require("express");
const rateLimit = require("express-rate-limit");
const { isLiveRead } = require("../middleware/rateLimiter");
test("only authenticated live reads receive the separate read budget", () => {
  for (const path of ["/chats", "/chats/live", "/chats/unread", "/chats/0123456789abcdef01234567/messages", "/workspace/announcements/live"]) expect(isLiveRead({ method: "GET", path })).toBe(true);
  for (const path of ["/auth/login", "/admin/users", "/workspace/notes", "/chats/invalid/messages"]) expect(isLiveRead({ method: "GET", path })).toBe(false);
  expect(isLiveRead({ method: "POST", path: "/chats" })).toBe(false);
});

function buildLimitedApp() {
  const app = express();
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again later." },
  });
  app.get("/limited", limiter, (req, res) => res.json({ ok: true }));
  return app;
}

test("allows requests under the limit", async () => {
  const app = buildLimitedApp();
  for (let i = 0; i < 3; i++) {
    const res = await request(app).get("/limited");
    expect(res.status).toBe(200);
  }
});

test("blocks requests once the limit is exceeded", async () => {
  const app = buildLimitedApp();

  for (let i = 0; i < 3; i++) {
    await request(app).get("/limited");
  }

  const blocked = await request(app).get("/limited");
  expect(blocked.status).toBe(429);
  expect(blocked.body.message).toMatch(/too many/i);
});
