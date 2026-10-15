const crypto = require("crypto");
const Session = require("../models/Session");
const lifetime = 8 * 60 * 60 * 1000;
const cookieName = () => process.env.NODE_ENV === "production" ? "__Host-postdate" : "postdate_session";
const options = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
const hash = token => crypto.createHash("sha256").update(token).digest("hex");
function readToken(req) {
  const prefix = `${cookieName()}=`;
  const values = (req.headers.cookie || "").split(";").map(v => v.trim()).filter(v => v.startsWith(prefix));
  if (values.length !== 1) return null;
  const token = values[0].slice(prefix.length);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
async function createSession(req, res, user) {
  const previous = readToken(req);
  if (previous) await Session.deleteOne({ digest: hash(previous) });
  const token = crypto.randomBytes(32).toString("hex");
  await Session.create({ digest: hash(token), userId: user._id, tokenVersion: user.tokenVersion || 0, expiresAt: new Date(Date.now() + lifetime) });
  res.cookie(cookieName(), token, { ...options(), maxAge: lifetime });
}
async function logout(req, res) {
  const token = readToken(req);
  if (token) await Session.deleteOne({ digest: hash(token) });
  res.clearCookie(cookieName(), options());
  res.json({ ok: true });
}
module.exports = { hash, readToken, createSession, logout, cookieName };
