const crypto = require("crypto");
const OTPAuth = require("otpauth");
const Challenge = require("../models/MfaChallenge");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const staffRequired = (role, enrollmentDeferred = false) => process.env.NODE_ENV === "production" && ["admin", "moderator"].includes(role) && !enrollmentDeferred;
function key() {
  if (!/^[a-f\d]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY || "")) throw new Error("MFA is not configured");
  return Buffer.from(process.env.MFA_ENCRYPTION_KEY, "hex");
}
function encrypt(secret) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}
function decrypt(secret) {
  const raw = Buffer.from(secret, "base64"), decipher = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
function counter(secret, code) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return null;
  const totp = new OTPAuth.TOTP({ issuer: "PostDate", secret, algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: code, window: 1 });
  return delta === null ? null : totp.counter() + delta;
}
async function begin(user, enroll = false) {
  key();
  const token = crypto.randomBytes(32).toString("base64url");
  const secret = enroll ? new OTPAuth.Secret({ size: 20 }).base32 : null;
  await Challenge.create({ tokenHash: hash(token), userId: user._id, version: user.sessionVersion || 0, enroll, secret: secret ? encrypt(secret) : undefined, expiresAt: new Date(Date.now() + 300000) });
  return { mfaRequired: true, mfaSetupRequired: enroll, challenge: token, ...(secret ? { secret } : {}) };
}
module.exports = { hash, staffRequired, encrypt, decrypt, counter, begin };
