const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../.env"), quiet: true });
if (!/^mongodb:\/\/(?:localhost|127\.0\.0\.1)(?::|\/)/.test(process.env.MONGO_URI || "")) {
  console.error("Set MONGO_URI in backend/.env to your local MongoDB database before starting locally.");
  process.exit(1);
}
// Serve the compiled site and API together so cookies, photos and live updates
// all use the same origin. These settings apply only to this local process.
process.env.NODE_ENV = "development";
process.env.HOST = "127.0.0.1";
process.env.PORT = process.env.PORT || "5000";
process.env.CLIENT_URL = `http://localhost:${process.env.PORT}`;
process.env.STORAGE_PROVIDER = "local";
process.env.SERVE_FRONTEND = "true";
process.env.TRUST_PROXY = "";
process.env.RENDER = "false";

require("../server").start().then(() => {
  console.log(`Open ${process.env.CLIENT_URL}`);
  console.log("Photos are stored in backend/uploads. Keep this folder with your database backups.");
}).catch(async error => {
  console.error(error.safeStartupMessage || "Could not start PostDate locally");
  await require("mongoose").disconnect();
  process.exitCode = 1;
});
