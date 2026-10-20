const cors = require("cors");
const clientOrigin = () => process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173";

function validatedOrigin() {
  const origin = clientOrigin();
  const url = new URL(origin);
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) {
    throw new Error("CLIENT_URL must be an exact HTTP or HTTPS origin without a trailing slash");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("Production CLIENT_URL must be an HTTPS origin");
  }
  return origin;
}

function validateEnvironment() {
  if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes of random secret material");
  }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  if (process.env.NODE_ENV === "production") {
    validatedOrigin();
    if (/replace-with|test-secret|change-?me|your[-_]secret/i.test(process.env.JWT_SECRET)) {
      throw new Error("Replace the placeholder JWT_SECRET before production startup");
    }
    if (!/^[a-f\d]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY || "")) throw new Error("Configure a stable MFA_ENCRYPTION_KEY before production startup");
    if (!require("../utils/verification").emailConfigured()) {
      throw new Error("Configure a Gmail, SMTP, or Resend sender before production startup");
    }
    if (process.env.STORAGE_PROVIDER === "cloudinary") require("../utils/cloudPhotos").cloudConfig();
    else if (process.env.STORAGE_PROVIDER !== "local") throw new Error("Set STORAGE_PROVIDER to cloudinary, or local only with a persistent disk");
    if (process.execArgv.some((arg) => arg.startsWith("--inspect")) || /--inspect/.test(process.env.NODE_OPTIONS || "")) {
      throw new Error("Production debugging is disabled");
    }
  }
}

function securityMiddleware() {
  const origin = validatedOrigin();
  const originGuard = (req, res, next) => {
    if (req.headers.origin && req.headers.origin !== origin) {
      return res.status(403).json({ message: "Origin is not allowed" });
    }
    // This non-simple header forces browsers to preflight every mutation,
    // including login. Hostile forms and cross-origin scripts cannot submit it.
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        (req.get("X-Postdate-Request") !== "1" || req.get("Sec-Fetch-Site") === "cross-site")) {
      return res.status(403).json({ message: "Request verification required" });
    }
    next();
  };
  const corsOptions = cors({
    origin,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Postdate-Request"],
    maxAge: 600,
  });
  return [originGuard, corsOptions];
}

function unsafeKeys(value, depth = 0) {
  if (depth > 20) return true;
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) =>
    key.startsWith("$") || key.includes(".") || ["__proto__", "constructor", "prototype"].includes(key) || unsafeKeys(nested, depth + 1)
  );
}

function validateRequest(req, res, next) {
  const query = req.query || {};
  const integerRanges = { page: [1, 10000], limit: [1, 100], minAge: [18, 120], maxAge: [18, 120], days: [1, 365] };
  const invalidQuery = Object.entries(query).some(([key, value]) => {
    // No current API accepts array/object query values. Reject duplicate keys
    // rather than letting regex/Number coercion accept a one-element array.
    if (typeof value !== 'string') return true;
    if (Object.hasOwn(integerRanges, key)) {
      const [min, max] = integerRanges[key];
      return !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max;
    }
    if (key === 'maxDistance') return !/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) > 10000;
    return false;
  });
  if (invalidQuery || Array.isArray(req.body) || (req.body != null && typeof req.body !== 'object') || unsafeKeys(req.body) || unsafeKeys(query)) {
    return res.status(400).json({ message: "Invalid input" });
  }
  next();
}

module.exports = { validateEnvironment, securityMiddleware, validateRequest };
