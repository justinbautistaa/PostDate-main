const Activity = require("../models/Activity");
module.exports = (req, res, next) => {
  res.on("finish", () => {
    if (req.method === "GET" && res.statusCode < 400) return;
    const category = req.user && ["admin", "moderator"].includes(req.user.role) ? "moderation" :
      /auth|verify|signup/.test(req.path) || [401, 403].includes(res.statusCode) ? "security" : "server";
    // Never store request bodies, credentials, query parameters, or tokens.
    Activity.create({ actor: req.user?.userId, role: req.user?.role, method: req.method,
      path: req.route?.path || "unmatched", status: res.statusCode, category }).catch(() => {});
  });
  next();
};
