const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
function allowedOrigins() {
  const origins = (process.env.CLIENT_URL || "http://localhost:5173").split(",").map(v => v.trim()).filter(Boolean);
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || !["http:", "https:"].includes(url.protocol) ||
        (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error("CLIENT_URL must contain exact origins; production requires HTTPS");
  }
  if (!origins.length) throw new Error("CLIENT_URL is required");
  if (process.env.NODE_ENV !== "production" && origins.includes("http://localhost:5173")) origins.push("http://127.0.0.1:5173");
  return origins;
}
function requestSecurity(origins) {
  return (req, res, next) => {
    const origin = req.get("Origin");
    if (origin && !origins.includes(origin)) return res.status(403).json({ message: "Origin not allowed" });
    // HTML forms cannot set this header. Cross-origin scripts must pass an
    // exact-origin CORS preflight; SameSite cookies add a second boundary.
    if (!SAFE_METHODS.has(req.method) && (req.get("X-PostDate-Request") !== "1" || req.get("Sec-Fetch-Site") === "cross-site")) {
      return res.status(403).json({ message: "Request verification failed" });
    }
    next();
  };
}
function validShape(value, depth = 0) {
  if (depth > 10) return false;
  if (value === null || typeof value !== "object") return true;
  return Object.entries(value).every(([key, entry]) => !key.startsWith("$") && !key.includes(".") &&
    !["__proto__", "constructor", "prototype"].includes(key) && validShape(entry, depth + 1));
}
function validateBody(req, res, next) {
  if (req.body !== undefined && (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || !validShape(req.body)))
    return res.status(400).json({ message: "Invalid request body" });
  next();
}
module.exports = { allowedOrigins, requestSecurity, validateBody, validShape };
