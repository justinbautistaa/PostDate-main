const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { readSession } = require("../utils/session");

// 🎛️ How often a busy user's lastActiveAt is allowed to be written. Without
// this, every single API call would also be a database write.
const ACTIVE_TOUCH_MS = 60 * 1000;

/**
 * requireAuth
 * Verifies the HttpOnly session cookie and attaches
 * { userId, role } to req.user for downstream handlers.
 *
 * Deliberately re-reads the user from the DB on every request rather than
 * trusting client session metadata. A session cannot carry admin rights
 * after its account has been demoted or deactivated.
 * That same re-read is what makes a suspension take effect immediately.
 *
 * Also stamps User.lastActiveAt (at most once a minute) — that's what the
 * dashboard's "Active" counter reads.
 *
 * Usage:
 *   router.get("/profile/me", requireAuth, asyncHandler(getMe));
 */
async function requireAuth(req, res, next) {
  try {
    const token = readSession(req);
    if (!token) return res.status(401).json({ message: "Authentication required" });
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"], issuer: "postdate", audience: "postdate-web",
    });
    const user = await User.findById(payload.userId).select("_id role isActive isVerified emailVerifiedAt sessionVersion lastActiveAt mfaEnabled deletionRequestedAt");
    if (!user || user.deletionRequestedAt || !user.isActive || !user.isVerified || (user.role === "user" && !user.emailVerifiedAt) || payload.version !== (user.sessionVersion || 0)) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if ((user.mfaEnabled || require("../utils/mfa").staffRequired(user.role)) && !payload.mfaVerified) return res.status(401).json({ message: "Multi-factor login required" });

    const now = Date.now();
    if (!user.lastActiveAt || now - user.lastActiveAt.getTime() > ACTIVE_TOUCH_MS) {
      // Fire and forget: a failed activity stamp must never fail the request.
      User.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date(now) } })
        .exec()
        .catch(() => console.error("[auth] activity update failed"));
    }

    req.user = { userId: user._id.toString(), role: user.role };
    next();
  } catch (err) {
    // Covers expired tokens, bad signatures, malformed tokens, etc. — all
    // read the same to the client on purpose.
    return res.status(401).json({ message: "Invalid or expired session" });
  }
}

/**
 * requireRole("admin", "moderator")
 * Use AFTER requireAuth on the same route. 403s if the current user's role
 * isn't one of the ones listed.
 *
 * Usage:
 *   router.get("/admin/ping", requireAuth, requireRole("admin", "moderator"), handler);
 */
function requireRole(...allowedRoles) {
  return function checkRole(req, res, next) {
    if (!req.user) {
      // Only happens if requireRole is used without requireAuth first —
      // fail closed rather than silently letting everyone through.
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "You don't have permission to do that" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
