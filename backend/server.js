const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.join(__dirname, ".env"), quiet: true });
const express = require("express");
const helmet = require("helmet");
const mongoose = require("mongoose");
const { startupStep } = require("./utils/startup");
const connectDB = require("./config/db");
const { generalLimiter, liveReadLimiter, isLiveRead } = require("./middleware/rateLimiter");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { validateEnvironment, securityMiddleware, validateRequest } = require("./middleware/security");
const { ensureUploadDir } = require("./utils/photoStorage");
const { isCloudStorage, cloudConfig } = require("./utils/cloudPhotos");

mongoose.set("debug", false);

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  require("./utils/proxy").configureProxy(app);
  app.use(helmet({ contentSecurityPolicy: { directives: {
    "upgrade-insecure-requests": process.env.NODE_ENV === "production" ? [] : null,
    "script-src": ["'self'"], "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com"], "img-src": ["'self'", "blob:", "data:", ...(isCloudStorage() ? [`https://res.cloudinary.com/${cloudConfig().cloud}/`] : [])],
    "connect-src": ["'self'"], "object-src": ["'none'"], "frame-ancestors": ["'none'"],
    "base-uri": ["'none'"], "form-action": ["'self'"],
  } } }));
  app.get("/healthz", (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.set("Cache-Control", "no-store").status(ready ? 200 : 503).json({ status: ready ? "ready" : "unavailable" });
  });
  app.use("/api", ...securityMiddleware());
  app.use("/api", (req, res, next) => {
    if (!isLiveRead(req)) return generalLimiter(req, res, next);
    require("./middleware/auth").requireAuth(req, res, () => liveReadLimiter(req, res, next));
  });
  app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.use(express.json({ limit: "64kb", strict: true }));
  app.use("/api", validateRequest);
  app.use("/api", require("./routes/authRoutes"));
  app.use("/api", require("./routes/mfaRoutes"));
  app.use("/api", require("./routes/privacyRoutes"));
  app.use("/api", require("./routes/profileRoutes"));
  app.use("/api", require("./routes/adminRoutes"));
  app.use("/api", require("./routes/safetyRoutes"));
  app.use("/api", require("./routes/pushRoutes"));
  app.use("/api", require("./routes/routes"));
  app.use("/api", require("./routes/memberRoutes"));
  app.use("/api", require("./routes/chatRoutes"));
  app.use("/api", require("./routes/workspaceRoutes"));
  app.use("/api", notFound);
  app.use(require("./routes/photoRoutes"));
  if (process.env.NODE_ENV === "production" || process.env.SERVE_FRONTEND === "true") {
    const frontend = path.join(__dirname, "../frontend/dist");
    app.use(express.static(frontend, { dotfiles: "deny", index: false }));
    app.get(["/", "/about", "/privacy", "/login", "/signup", "/appeal", "/profile", "/discover", "/dashboard", "/user", "/messages", "/my-reports", "/admin", "/staff", "/moderator"], (req, res) => {
      res.set("Cache-Control", "no-cache");
      res.sendFile(path.join(frontend, "index.html"));
    });
  } else {
    app.get("/", (req, res) => res.send("PostDate API is running"));
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

async function start() {
  await startupStep("environment configuration", validateEnvironment);
  await startupStep("MongoDB connection", connectDB);
  await startupStep("optional demo dataset", () => require("./utils/seedDemoOnce").seedDemoOnce());
  await startupStep("optional photo diagnostic", () => require("./utils/photoDiagnostic").diagnosePhoto());
  await startupStep("photo storage", ensureUploadDir);
  await startupStep("rate counter indexes", () => require("./models/RateCounter").init());
  await startupStep("account rate indexes", () => require("./models/RequestBucket").init());
  await startupStep("swipe indexes", () => require("./models/Swipe").init());
  await startupStep("match indexes", () => require("./models/Match").init());
  await startupStep("message indexes", () => require("./models/Message").init());
  await startupStep("workspace indexes", () => require("./models/WorkspaceEntry").init());
  await startupStep("push subscription indexes", () => require("./models/PushSubscription").init());
  await startupStep("deletion queue indexes", () => require("./models/DeletionJob").init());
  await startupStep("MFA challenge indexes", () => require("./models/MfaChallenge").init());
  const app = await startupStep("HTTP configuration and client origin", createApp);
  const server = app.listen(process.env.PORT || 5000, process.env.HOST || "0.0.0.0", () => console.log("Server started"));
  const stopCleanup = require("./utils/accountDeletion").startDeletionWorker();
  for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => {
    stopCleanup();
    const timer = setTimeout(() => process.exit(1), 10000);
    timer.unref();
    server.close(async () => { await mongoose.disconnect(); clearTimeout(timer); });
  });
  return server;
}

if (require.main === module) start().catch(async (error) => {
  console.error(error.safeStartupMessage || "Startup failed: check server configuration");
  await mongoose.disconnect();
  process.exitCode = 1;
});
module.exports = { createApp, start };
