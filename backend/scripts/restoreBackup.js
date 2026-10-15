require("dotenv").config({ path: require("path").join(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
const fs = require("fs/promises");
const { keyFromEnvironment, decrypt, restoreToTestDatabase } = require("../utils/backup");
(async () => {
  if (!process.env.POSTDATE_RESTORE_TEST_URI || !process.argv[2]) throw new Error("Provide a test database URI and backup path");
  const data = decrypt(await fs.readFile(process.argv[2]), keyFromEnvironment());
  await mongoose.connect(process.env.POSTDATE_RESTORE_TEST_URI, { serverSelectionTimeoutMS: 10000 });
  await restoreToTestDatabase(mongoose.connection.db, data);
  console.log("Backup restored into an empty restore_test database. Verify records before considering recovery of live data.");
})().catch(() => { console.error("Restore failed; check the key, authenticated backup and empty restore_test database."); process.exitCode = 1; }).finally(() => mongoose.disconnect());
