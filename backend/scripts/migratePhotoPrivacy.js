require("dotenv").config({ path: require("path").join(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
const Profile = require("../models/Profile");
const { cloudConfig, validFilename, migrateCloudPhoto } = require("../utils/cloudPhotos");
(async () => {
  cloudConfig();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const profiles = await Profile.find({}).select("photos").lean();
  const names = [...new Set(profiles.flatMap(profile => profile.photos || []).map(value => require("path").basename(value)).filter(validFilename))];
  if (!process.argv.includes("--apply")) { console.log(`${names.length} photo references found. No changes made. Run with --apply to migrate legacy public Cloudinary assets to authenticated delivery.`); return; }
  let changed = 0, failed = 0;
  for (const name of names) { try { await migrateCloudPhoto(name); changed++; } catch { failed++; } }
  console.log(`Migration finished: ${changed} converted; ${failed} need review or were already private. Check provider delivery and CDN invalidation before claiming old links are inaccessible.`);
})().catch(() => { console.error("Photo migration could not complete. Check database and Cloudinary configuration; no credentials were logged."); process.exitCode = 1; }).finally(() => mongoose.disconnect());
