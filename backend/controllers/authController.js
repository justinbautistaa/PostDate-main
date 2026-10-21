const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { setSession, clearSession } = require("../utils/session");
const { codeHash, emailCode } = require("../utils/verification");
const User = require("../models/User");
const Profile = require("../models/Profile");
const { isValidEmail, isNonEmptyString } = require("../utils/validators");
const {
  PERSONALITY_OPTIONS,
  LIMITS,
  validateSelection,
  parseListField,
} = require("../utils/tasteOptions");
const { savePhotosToDisk, deletePhotoFile } = require("../utils/photoStorage");

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 12;
const MIN_SIGNUP_AGE = 18;

/**
 * "YYYY-MM-DD" — what a native <input type="date"> sends (see
 * WhoAreYouForm.jsx) — -> a real Date, or null if it doesn't parse.
 *
 * 🔁 CHANGED: the birthdate field used to be free text in "MM/DD/YY" format,
 * parsed by hand here. It's now a real date picker, which always sends ISO
 * "YYYY-MM-DD" — much less room for garbage input, so this got simpler too.
 */
function parseBirthdate(input) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input ?? "").trim());
  if (!match) return null;

  const [, yyyy, mm, dd] = match;
  const year = Number(yyyy);
  const date = new Date(Date.UTC(year, Number(mm) - 1, Number(dd)));

  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === Number(mm) - 1 &&
    date.getUTCDate() === Number(dd);

  return valid ? date : null;
}

/** Whole years between a birthdate and today, UTC-based to match parseBirthdate. */
function calculateAge(dateOfBirth) {
  const today = new Date();
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > dateOfBirth.getUTCMonth() ||
    (today.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      today.getUTCDate() >= dateOfBirth.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

/**
 * POST /api/signup
 * Creates the User (auth fields) and its Profile (dateOfBirth/gender/bio/
 * interests/photos) together. If the Profile fails to save, the User is
 * removed again rather than leaving a half-created account behind — and any
 * photos already written to disk for this request are cleaned up too, so a
 * failed signup never leaves orphan files.
 */
async function register(req, res) {
  let createdUser;
  let savedPhotos = [];
  try {
    const { firstName, middleName, lastName, email, password, birthdate, gender, bio, tags } =
      req.body ?? {};

    if (
      !isNonEmptyString(firstName, 50) ||
      !isNonEmptyString(lastName, 50) ||
      !isNonEmptyString(gender, 50) ||
      !isNonEmptyString(password) ||
      !birthdate
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (![true, "true"].includes(req.body.privacyConsent)) return res.status(400).json({ message: "Read and acknowledge the privacy notice before creating an account." });
    if (!["female", "male", "nonbinary", "self-describe", "prefer-not-to-say"].includes(gender)) return res.status(400).json({ message: "Choose a valid gender." });
    if (password.length < MIN_PASSWORD_LENGTH || Buffer.byteLength(password, "utf8") > 72) {
      return res
        .status(400)
        .json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters and at most 72 UTF-8 bytes` });
    }

    if ((middleName !== undefined && (typeof middleName !== "string" || middleName.length > 50)) ||
        (bio !== undefined && (typeof bio !== "string" || bio.length > 1000))) {
      return res.status(400).json({ message: "Invalid profile fields" });
    }

    const dateOfBirth = parseBirthdate(birthdate);
    if (!dateOfBirth) {
      return res.status(400).json({ message: "Enter a valid birthdate" });
    }
    if (dateOfBirth.getTime() > Date.now()) {
      return res.status(400).json({ message: "Birthdate can't be in the future" });
    }
    if (calculateAge(dateOfBirth) < MIN_SIGNUP_AGE) {
      return res
        .status(400)
        .json({ message: `You must be at least ${MIN_SIGNUP_AGE} to sign up` });
    }

    // On a multipart request every field (tags included) arrives as text,
    // so this reads either a real array (plain JSON) or a JSON-encoded
    // string of one (multipart) — see parseListField.
    const parsedTags = parseListField(tags);
    if (parsedTags === null) {
      return res.status(400).json({ message: "Invalid taste tags" });
    }
    // No minimum enforced here: YourTasteForm already requires at least 3
    // before it will call onConfirm, and a JSON caller with no taste step
    // yet (or a test) shouldn't be blocked by a server-side minimum too.
    const tagsResult = validateSelection(parsedTags, PERSONALITY_OPTIONS, {
      max: LIMITS.maxPersonality,
      label: "taste tags",
    });
    if (!tagsResult.ok) {
      return res.status(400).json({ message: tagsResult.message });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: "An account with that email already exists" });
    }

    const files = req.files ?? [];
    // Decode all images before creating database records.
    savedPhotos = files.length > 0 ? await savePhotosToDisk(files) : [];
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      firstName: firstName.trim(),
      middleName: middleName?.trim(),
      lastName: lastName.trim(),
      privacyConsentAt: new Date(), privacyPolicyVersion: "2026-10-16",
    });

    createdUser = user;

    await Profile.create({
      userId: user._id,
      dateOfBirth,
      gender,
      bio,
      interests: tagsResult.value,
      photos: savedPhotos,
      avatar: savedPhotos[0] ?? null,
    });

    return res.status(201).json({ userId: user._id });
  } catch (err) {
    if (createdUser) await User.deleteOne({ _id: createdUser._id });
    await Promise.all(savedPhotos.map((photo) => deletePhotoFile(photo).catch(() => {})));
    if (err.status === 400) return res.status(400).json({ message: "Invalid image upload" });
    if (err?.code === 11000) {
      // two requests raced past the findOne check above
      return res.status(409).json({ message: "An account with that email already exists" });
    }
    // Preserve safe storage diagnostics for signup photos as well as the
    // profile upload route. Never expose raw provider or database errors.
    if (typeof err.code === "string" && err.code.startsWith("PHOTO_STORAGE_")) throw err;
    console.error("[auth] register failed", err.name === "ValidationError" ? "validation" : "internal");
    return res.status(500).json({ message: "Could not create account" });
  }
}

/**
 * POST /api/auth/login
 * 401 for a wrong email OR password (same reply for both, so this can't be
 * used to find out which emails have accounts). 403 for a correct email and
 * password on an account that hasn't verified yet — LoginForm.jsx shows a
 * different message for that one specifically.
 */
async function login(req, res) {
  let attempt;
  try {
    const { email, password } = req.body ?? {};
    if (!isValidEmail(email) || !isNonEmptyString(password) || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    attempt = await require('../utils/passwordAttempts').reservePasswordAttempt(email);
    if (!attempt.allowed) {
      res.set('Retry-After', String(attempt.retryAfter));
      return res.status(429).json({ message: 'Too many incorrect login attempts. Please try again in ' + Math.ceil(attempt.retryAfter / 60) + ' minute(s).', retryAfter: attempt.retryAfter });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash +sessionVersion +deletionRequestedAt +mfaEnrollmentDeferred");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      attempt = null; // Keep this reservation as a failed credential attempt.
      return res.status(401).json({ message: "Wrong email or password" });
    }
    await attempt.release();
    attempt = null; // Correct passwords, including those leading to MFA, do not consume the failure budget.
    if (!user.isActive || user.deletionRequestedAt) {
      return res.status(403).json({ message: "This account has been deactivated" });
    }
    if (!user.isVerified || (user.role === "user" && !user.emailVerifiedAt)) {
      return res.status(403).json({ message: "Verify your email before logging in" });
    }

    if (user.mfaEnabled || require("../utils/mfa").staffRequired(user.role, user.mfaEnrollmentDeferred)) {
      try { return res.json(await require("../utils/mfa").begin(user, !user.mfaEnabled)); }
      catch { return res.status(503).json({ message: "Multi-factor authentication is unavailable. Contact the site administrator." }); }
    }
    setSession(res, user);
    return res.json({ userId: user._id, role: user.role });
  } catch (err) {
    if (attempt?.allowed) await attempt.release().catch(() => {});
    console.error("[auth] login failed");
    return res.status(500).json({ message: "Could not log in" });
  }
}

// Resends are limited per account as well as per IP. Codes are never logged.
async function sendVerificationCode(req, res) {
  const { email } = req.body ?? {};
  if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address" });
  if (!require("../utils/verification").emailConfigured()) {
    return res.status(503).json({ message: "Email verification is not configured" });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const hash = codeHash(normalizedEmail, code);
  const user = await User.findOneAndUpdate({
    email: normalizedEmail,
    $and: [
      { $or: [{ isVerified: false }, { role: "user", emailVerifiedAt: null }] },
      { $or: [{ verificationSentAt: { $exists: false } }, { verificationSentAt: { $lt: new Date(Date.now() - 60000) } }] },
    ],
  }, { $set: {
    verificationHash: hash, verificationExpiresAt: new Date(Date.now() + 300000),
    verificationAttempts: 0, verificationSentAt: new Date(),
  } });
  if (user) {
    try {
      await emailCode(normalizedEmail, code);
    } catch {
      await User.updateOne({ _id: user._id, verificationHash: hash }, {
        $unset: { verificationHash: 1, verificationExpiresAt: 1, verificationSentAt: 1 },
      });
      return res.status(503).json({ message: "Could not send verification email" });
    }
  }
  // Same reply for unknown, verified and recently requested addresses.
  return res.json({ expiresIn: 300 });
}

async function verifyCode(req, res) {
  const { email, code } = req.body ?? {};
  if (!isValidEmail(email) || typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: "Enter a valid email and six-digit code" });
  }
  const normalizedEmail = email.trim().toLowerCase();
  // Increment atomically first, so parallel guesses cannot evade the budget.
  const candidate = await User.findOneAndUpdate({
    email: normalizedEmail,
    $or: [{ isVerified: false }, { role: "user", emailVerifiedAt: null }],
    verificationExpiresAt: { $gt: new Date() }, verificationAttempts: { $lt: 5 },
  }, { $inc: { verificationAttempts: 1 } }, { new: true }).select("+verificationHash");
  const hash = codeHash(normalizedEmail, code);
  if (!candidate || !candidate.verificationHash || !crypto.timingSafeEqual(
    Buffer.from(candidate.verificationHash, "hex"), Buffer.from(hash, "hex")
  )) return res.json({ verified: false });
  // Consume the exact code once, also protecting against resend/confirm races.
  const user = await User.findOneAndUpdate({
    _id: candidate._id, verificationHash: hash,
    $or: [{ isVerified: false }, { role: "user", emailVerifiedAt: null }],
    verificationExpiresAt: { $gt: new Date() },
  }, {
    $set: { isVerified: true, emailVerifiedAt: new Date() },
    $unset: { verificationHash: 1, verificationExpiresAt: 1, verificationAttempts: 1, verificationSentAt: 1 },
  }, { new: true });
  if (!user) return res.json({ verified: false });
  return res.json({ verified: true, userId: user._id, role: user.role });
}

async function logout(req, res) {
  await User.updateOne({ _id: req.user.userId }, { $inc: { sessionVersion: 1 } });
  await require("../models/PushSubscription").deleteMany({ userId: req.user.userId });
  clearSession(res);
  return res.json({ ok: true });
}

function session(req, res) {
  return res.json({ userId: req.user.userId, role: req.user.role });
}

module.exports = {
  logout,
  session,
  register,
  login,
  sendVerificationCode,
  verifyCode,
  parseBirthdate,
  calculateAge,
};
