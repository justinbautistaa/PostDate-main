require("dotenv").config({ path: require("path").join(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
(async () => {
  const apply = process.argv.includes("--apply");
  if (apply && !process.argv.includes("--confirm-demo-removal")) throw new Error("Explicit confirmation required");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log(JSON.stringify(await require("../utils/demoCleanup").cleanupDemo({ apply })));
  if (!apply) console.log("Preview only. Nothing was removed. Review before using --apply --confirm-demo-removal.");
})().catch(() => { console.error("Demo cleanup refused or failed; review the completed-run marker and any real-account interactions. No automatic reset was performed."); process.exitCode = 1; }).finally(() => mongoose.disconnect());
