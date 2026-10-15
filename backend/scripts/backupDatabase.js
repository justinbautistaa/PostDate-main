require("dotenv").config({ path: require("path").join(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
const fs = require("fs/promises");
const path = require("path");
const { keyFromEnvironment, snapshot, encrypt } = require("../utils/backup");
(async () => {
  const key = keyFromEnvironment();
  if (!process.env.MONGO_URI) throw new Error("Missing database configuration");
  const output = process.argv[2];
  if (!output) throw new Error("Provide an output .encrypted file path");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const data = encrypt(await snapshot(mongoose.connection.db), key);
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await fs.writeFile(output, data, { flag: "wx", mode: 0o600 });
  console.log("Encrypted database backup created. Store it off-host with its key stored separately.");
})().catch(() => { console.error("Backup failed; check configuration, output path and database access."); process.exitCode = 1; }).finally(() => mongoose.disconnect());
