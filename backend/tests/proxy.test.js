const express = require("express");
const request = require("supertest");
const { configureProxy } = require("../utils/proxy");
function appFor(env) {
  const app = express(); configureProxy(app, env);
  app.get("/", (req, res) => res.json({ ip: req.ip })); return app;
}
test("Render separates client addresses without trusting a forged leading address", async () => {
  const app = appFor({ RENDER: "true", NODE_ENV: "production" });
  const a = await request(app).get("/").set("X-Forwarded-For", "1.2.3.4, 198.51.100.10");
  const b = await request(app).get("/").set("X-Forwarded-For", "9.8.7.6, 198.51.100.11");
  expect(a.body.ip).toBe("198.51.100.10"); expect(b.body.ip).toBe("198.51.100.11");
});
test("localhost does not trust user supplied forwarded headers", async () => {
  const result = await request(appFor({ NODE_ENV: "development" })).get("/").set("X-Forwarded-For", "1.2.3.4");
  expect(result.body.ip).not.toBe("1.2.3.4");
});
test("explicit proxy settings take precedence", () => {
  expect(appFor({ RENDER: "true", NODE_ENV: "production", TRUST_PROXY: "loopback" }).get("trust proxy")).toEqual(["loopback"]);
});
