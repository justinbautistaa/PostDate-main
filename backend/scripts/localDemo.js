// Isolated demo launcher. Never reads the production database URI or changes backend/.env.
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

const credentialsPath = path.join(__dirname, "../.env.demo");
const uri = "mongodb://127.0.0.1:27017/postdate_demo";
async function main() {
  let settings;
  try { settings = dotenv.parse(await fs.readFile(credentialsPath)); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    settings = {
      LOCAL_DEMO_EMAIL: "admin@demo.postdate.test",
      LOCAL_DEMO_PASSWORD: crypto.randomBytes(18).toString("base64url"),
      JWT_SECRET: crypto.randomBytes(48).toString("hex"),
      MFA_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"),
    };
    await fs.writeFile(credentialsPath, dotenvString(settings), { flag: "wx", mode: 0o600 });
  }
  Object.assign(process.env, settings, {
    MONGO_URI: uri, NODE_ENV: "development", PORT: "5001", HOST: "127.0.0.1",
    CLIENT_URL: "http://localhost:5001", SERVE_FRONTEND: "true", STORAGE_PROVIDER: "local",
    TRUST_PROXY: "", RENDER: "false", MAIL_MODE: "disabled", MAIL_API_KEY: "", MAIL_FROM: "",
    VAPID_PUBLIC_KEY: "", VAPID_PRIVATE_KEY: "", VAPID_SUBJECT: "",
  });
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const User = require("../models/User");
  if (await User.exists({ email: { $not: /@demo\.postdate\.test$/ } })) {
    throw new Error("The demo database contains non-demo accounts; refusing to modify it");
  }
  const count = await User.countDocuments({ role: "user" });
  if (!count) {
    await mongoose.disconnect();
    const result = spawnSync(process.execPath, [path.join(__dirname, "seedDemoData.js")], {
      env: process.env, stdio: "inherit", windowsHide: true,
    });
    if (result.status !== 0) throw new Error("Demo seed failed");
    await mongoose.connect(uri);
  }
  await User.init();
  if (!await User.exists({ email: settings.LOCAL_DEMO_EMAIL })) {
    await User.create({
      email: settings.LOCAL_DEMO_EMAIL,
      passwordHash: await bcrypt.hash(settings.LOCAL_DEMO_PASSWORD, 12),
      firstName: "Demo", lastName: "Administrator", role: "admin", isVerified: true,
      emailVerifiedAt: new Date(),
    });
  }
  const counts = {
    members: await User.countDocuments({ role: "user" }),
    moderators: await User.countDocuments({ role: "moderator" }),
    matches: await require("../models/Match").countDocuments(),
    ratings: await require("../models/Rating").countDocuments(),
    reports: await require("../models/Report").countDocuments(),
    appeals: await require("../models/Appeal").countDocuments(),
  };
  if (counts.members !== 64 || counts.moderators !== 2 || counts.matches !== 110 ||
      !counts.ratings || counts.reports !== 28 || counts.appeals > 5) {
    throw new Error("Existing local demo data does not match the requested counts; no reset was performed");
  }
  console.log("Verified local demo counts:", JSON.stringify(counts));
  console.log("Local administrator credentials: backend/.env.demo (ignored by Git)");
  await mongoose.disconnect();
  if (process.argv.includes("--seed-only")) return;
  await require("../server").start();
  console.log("Local demo: http://localhost:5001/admin");
}
function dotenvString(settings) {
  return "# LOCAL DEMO ONLY. Never deploy or commit this file.\n" +
    Object.entries(settings).map(([key, value]) => `${key}=${value}`).join("\n") + "\n";
}
main().catch(async () => {
  console.error("Local demo failed. Check local MongoDB and the isolated demo database; production was not changed.");
  await mongoose.disconnect();
  process.exitCode = 1;
});
