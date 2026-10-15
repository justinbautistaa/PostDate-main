/**
 * createAdmin
 * Creates a staff account (or promotes an existing one). There is no sign-up
 * path for staff on purpose — the public sign-up form only ever makes
 * ordinary members — so this is how the first admin comes into existence.
 *
 *   npm run make-admin -- --email you@example.com --first Ada --last Lovelace
 *   npm run make-admin -- --email mod@example.com --first Sam --last Ng --role moderator
 *
 * The password is read from --password, or the ADMIN_PASSWORD environment
 * variable, or (if neither is given) you're asked for it. Prefer the prompt or
 * the env var: anything typed after --password stays in your shell history.
 *
 * If the email already has an account it's promoted to the chosen role (and
 * verified + reactivated); its password is NOT touched.
 */
const path = require("path");
const readline = require("readline");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const User = require("../models/User");
const { isValidEmail } = require("../utils/validators");

const SALT_ROUNDS = 12; // keep in step with authController.js
const MIN_STAFF_PASSWORD = 12; // staff accounts hold more power, so a longer minimum than members' 8

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) {
      out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[(i += 1)] : true;
    }
  }
  return out;
}

/** Asks for the password without echoing it. */
function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      // Print the question once, swallow everything typed afterwards.
      if (text.includes(question)) process.stdout.write(question);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = String(args.email || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const role = args.role || "admin";

  if (!isValidEmail(email)) throw new Error("Pass a valid --email (or set ADMIN_EMAIL).");
  if (!["admin", "moderator"].includes(role)) throw new Error('--role must be "admin" or "moderator".');
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set — check backend/.env.");

  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ email }).select("+sessionVersion");
  if (existing) {
    existing.sessionVersion = (existing.sessionVersion || 0) + 1;
    existing.role = role;
    existing.isVerified = true;
    existing.isActive = true;
    existing.suspendedAt = null;
    existing.suspensionReason = "";
    existing.suspendedBy = null;
    await existing.save();
    console.log(`Updated existing staff account to ${role}.`);
    return;
  }

  const firstName = String(args.first || "Admin").trim();
  const lastName = String(args.last || "User").trim();

  let password = args.password === true ? "" : args.password || process.env.ADMIN_PASSWORD || "";
  if (!password) password = await promptHidden("Password (min 12 characters): ");
  if (String(password).length < MIN_STAFF_PASSWORD || Buffer.byteLength(String(password), "utf8") > 72) {
    throw new Error(`Staff passwords need at least ${MIN_STAFF_PASSWORD} characters.`);
  }

  await User.create({
    email,
    passwordHash: await bcrypt.hash(String(password), SALT_ROUNDS),
    firstName,
    lastName,
    role,
    isVerified: true, // staff skip the email-code step; there's no sign-up flow for them
  });
  console.log(`Created ${role} account.`);
}

main()
  .catch((err) => {
    console.error("Staff account setup failed. Check configuration and input.");
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
