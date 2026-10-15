const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const { generalLimiter } = require("./middleware/rateLimiter");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { allowedOrigins, requestSecurity, validateBody } = require("./middleware/requestSecurity");
const { requireAuth } = require("./middleware/auth");
const { asyncHandler } = require("./middleware/errorHandler");
const app = express();
app.disable("x-powered-by");
const origins = allowedOrigins();
app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-site" },
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], scriptSrcAttr: ["'none'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"], imgSrc: ["'self'", "blob:", "data:"],
    connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"],
    formAction: ["'self'"], baseUri: ["'none'"],
    upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
  } },
}));
app.use((req, res, next) => {
  // Never serve configuration, source control files, or arbitrary dotfiles.
  let decodedPath;
  try { decodedPath = decodeURIComponent(req.path); } catch { return res.sendStatus(400); }
  if (decodedPath.split("/").some(part => part.startsWith("."))) return res.sendStatus(404);
  next();
});
app.use(requestSecurity(origins));
app.use(cors({ origin: origins, credentials: true, methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-PostDate-Request"], exposedHeaders: ["X-Next-Cursor"] }));
app.use("/api", generalLimiter);
app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
app.use(express.json({ limit: "100kb" }));
app.use(validateBody);
app.get("/api/health", (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ok: ready });
});
app.use("/api", require("./middleware/activity"));
app.use("/api", require("./routes/authRoutes"));
app.use("/api", require("./routes/routes"));
app.use("/api", notFound);
// Legacy disk images are authenticated, ownership-checked and re-encoded.
app.get("/uploads/:filename", generalLimiter, requireAuth, asyncHandler(require("./controllers/featuresController").getLegacyPhoto));
app.use("/uploads", notFound);
if (process.env.NODE_ENV === "production") {
  const build = path.join(__dirname, "..", "frontend", "dist");
  app.use(express.static(build, { dotfiles: "deny", index: false }));
  app.get("*", (req, res) => res.sendFile(path.join(build, "index.html")));
} else app.get(["/", "/api"], (req, res) => res.json({ message: "PostDate API is running" }));
app.use(notFound);
app.use(errorHandler);
module.exports = app;
