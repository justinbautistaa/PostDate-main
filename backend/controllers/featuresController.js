const User = require("../models/User");
const Profile = require("../models/Profile");
const Photo = require("../models/Photo");
const Swipe = require("../models/Swipe");
const Match = require("../models/Match");
const Activity = require("../models/Activity");
const { preparePhotos, savePhotos } = require("../middleware/uploads");
const { PERSONALITY_OPTIONS } = require("../utils/tasteOptions");
const { calculateAge } = require("./authController");
const isId = value => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
const bad = message => Object.assign(new Error(message), { status: 400 });

async function getProfile(req, res) {
  const id = req.params.userId === "me" ? req.user.userId : req.params.userId;
  if (!isId(id)) throw bad("Invalid profile ID");
  const user = await User.findOne({ _id: id, isActive: true, isVerified: true }).select("firstName lastName createdAt").lean();
  const profile = await Profile.findOne({ userId: id }).lean();
  if (!user || !profile) return res.status(404).json({ message: "Profile not found" });
  res.json({ id: String(user._id), name: profile.profileName || `${user.firstName} ${user.lastName}`,
    age: calculateAge(profile.dateOfBirth), gender: profile.gender, bio: profile.bio || "",
    birthdate: id.toLowerCase() === req.user.userId ? profile.dateOfBirth.toISOString().slice(0, 10) : "Private",
    tags: [...new Set(PERSONALITY_OPTIONS)].map(label => ({ label, selected: profile.interests.includes(label) })),
    lookingFor: profile.lookingFor?.intents || [], photoPaths: profile.photos, avatarPath: profile.avatar,
    followers: profile.followersCount, following: profile.followingCount, reviews: [],
    dateJoined: user.createdAt.toISOString().slice(0, 10),
    address: [profile.location?.city, profile.location?.country].filter(Boolean).join(", ") });
}
async function updateProfile(req, res) {
  const { latitude, longitude } = req.body || {};
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw bad("Invalid coordinates");
  const profile = await Profile.findOneAndUpdate({ userId: req.user.userId }, { $set: { "location.latitude": latitude, "location.longitude": longitude } }, { new: true, runValidators: true });
  if (!profile) return res.status(404).json({ message: "Profile not found" });
  res.json({ ok: true });
}
async function uploadPhotos(req, res) {
  if (!req.files?.length) throw bad("No photos were sent");
  const userId = req.user.userId;
  const existing = await Profile.findOne({ userId }).lean();
  if (!existing) return res.status(404).json({ message: "Profile not found" });
  const paths = await savePhotos(userId, await preparePhotos(req.files));
  try {
    const profile = await Profile.findOneAndUpdate({ userId, $expr: { $lte: [{ $size: "$photos" }, 30 - paths.length] } },
      [{ $set: { photos: { $concatArrays: ["$photos", paths] }, avatar: { $ifNull: ["$avatar", paths[0]] } } }], { new: true });
    if (!profile) throw bad("You can keep up to 30 photos");
    res.json(profile.photos.map(url => ({ id: url.split("/").pop(), url })));
  } catch (error) {
    // A write can commit even when its acknowledgement is lost. Keep referenced photos.
    const current = await Profile.findOne({ userId }).lean();
    const unused = paths.filter(path => !current?.photos.includes(path));
    await Photo.deleteMany({ userId, _id: { $in: unused.map(path => path.split("/").pop()) } });
    throw error;
  }
}
async function getPhoto(req, res) {
  if (!isId(req.params.id)) return res.sendStatus(404);
  const photo = await Photo.findById(req.params.id);
  if (!photo) return res.sendStatus(404);
  if (!(await User.exists({ _id: photo.userId, isActive: true, isVerified: true })) ||
      !(await Profile.exists({ userId: photo.userId, photos: `/api/photos/${photo._id}` }))) return res.sendStatus(404);
  res.type("jpeg").send(photo.data);
}
async function getLegacyPhoto(req, res) {
  const filename = req.params.filename;
  if (!/^[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) return res.sendStatus(404);
  const profile = await Profile.findOne({ photos: `/uploads/${filename}` }).select("userId").lean();
  if (!profile || !(await User.exists({ _id: profile.userId, isActive: true, isVerified: true }))) return res.sendStatus(404);
  const file = require("path").join(require("../utils/photoStorage").UPLOAD_DIR, filename);
  try {
    const data = await require("sharp")(file, { limitInputPixels: 25000000 }).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg().toBuffer();
    res.set("Cache-Control", "no-store").type("jpeg").send(data);
  } catch { res.sendStatus(404); }
}
async function swipe(req, res) {
  const raw = req.body?.profileId;
  if (!isId(raw)) throw bad("Invalid profile ID");
  const toUserId = raw.toLowerCase(), fromUserId = req.user.userId;
  if (toUserId === fromUserId) throw bad("You cannot swipe on yourself");
  if (!(await User.exists({ _id: toUserId, isActive: true, isVerified: true }))) return res.status(404).json({ message: "Profile not found" });
  const action = req.params.action;
  if (!["like", "pass"].includes(action)) return res.sendStatus(404);
  await Swipe.updateOne({ fromUserId, toUserId }, { $set: { action } }, { upsert: true });
  const matched = action === "like" && !!(await Swipe.exists({ fromUserId: toUserId, toUserId: fromUserId, action: "like" }));
  if (matched) {
    const [user1, user2] = [fromUserId, toUserId].sort();
    await Match.updateOne({ user1, user2 }, { $setOnInsert: { status: "active" } }, { upsert: true });
  }
  res.json({ ok: true, matched });
}
async function adminSection(req, res) {
  const section = req.params.section;
  const staff = ["statistics", "users", "reports", "ratings", "appeals", "mod-activity"];
  const admin = ["privacy", "server-logs", "security-logs", "settings"];
  if (![...staff, ...admin].includes(section)) return res.sendStatus(404);
  if (admin.includes(section) && req.user.role !== "admin") return res.sendStatus(403);
  if (section === "statistics") return res.json({ columns: ["Metric", "Count"], rows: [
    { Metric: "Users", Count: await User.countDocuments() }, { Metric: "Matches", Count: await Match.countDocuments({ status: "active" }) }] });
  if (section === "users") {
    const users = await User.find().select("firstName lastName role isActive createdAt").sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ columns: ["User", "Role", "Status"], rows: users.map(u => ({ User: `${u.firstName} ${u.lastName}`, Role: u.role, Status: u.isActive ? "Active" : "Inactive" })) });
  }
  if (section === "settings") return res.json({ columns: ["Setting", "Value"], rows: [{ Setting: "Maximum profile photos", Value: 30 }] });
  let model, filter = {};
  if (section.endsWith("logs") || section === "mod-activity") { model = Activity; filter.category = ({ "server-logs": "server", "security-logs": "security", "mod-activity": "moderation" })[section]; }
  else if (["appeals", "privacy"].includes(section)) { model = require("../models/SupportRequest"); filter.kind = section === "appeals" ? "appeal" : "privacy"; }
  else model = require(section === "reports" ? "../models/Report" : "../models/Rating");
  const records = await model.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  const columns = ["ID", "Status", "Created"];
  res.json({ columns, rows: records.map(r => ({ ID: String(r._id), Status: String(r.status ?? r.score ?? ""), Created: r.createdAt?.toISOString() || "" })) });
}
async function activeCount(req, res) { res.json({ activeCount: await User.countDocuments({ isActive: true, isVerified: true }) }); }
module.exports = { getProfile, updateProfile, uploadPhotos, getPhoto, getLegacyPhoto, swipe, adminSection, activeCount };
