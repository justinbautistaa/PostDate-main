const jwt = require("jsonwebtoken");

const SESSION_SECONDS = 8 * 60 * 60;
const cookieName = () => process.env.NODE_ENV === "production" ? "__Host-postdate" : "postdate";
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: SESSION_SECONDS * 1000,
});

function setSession(res, user, mfaVerified = false) {
  const token = jwt.sign(
    { userId: String(user._id), version: user.sessionVersion || 0, mfaVerified },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: SESSION_SECONDS, issuer: "postdate", audience: "postdate-web" }
  );
  res.cookie(cookieName(), token, cookieOptions());
}

function readSession(req) {
  const cookies = (req.headers.cookie || "").split(";");
  const match = cookies.find((cookie) => cookie.trim().startsWith(`${cookieName()}=`));
  return match ? decodeURIComponent(match.trim().slice(cookieName().length + 1)) : null;
}

function clearSession(res) {
  const { maxAge, ...options } = cookieOptions();
  res.clearCookie(cookieName(), options);
}

module.exports = { setSession, readSession, clearSession };
