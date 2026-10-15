const mongoose = require("mongoose");
const Profile = require("../models/Profile");
const bad = message => Object.assign(new Error(message), { status: 400 });
const isId = value => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
const genders = { Woman: ["female", "woman"], Man: ["male", "man"], "Non-binary": ["nonbinary", "non-binary"] };
function birthdayCutoff(years) {
  const now = new Date(), year = now.getUTCFullYear() - years, month = now.getUTCMonth();
  const day = Math.min(now.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day));
}
function numberParam(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !value.trim()) throw bad("Invalid filters");
  const result = Number(value);
  if (!Number.isFinite(result)) throw bad("Invalid filters");
  return result;
}
async function discover(req, res) {
  const { query = "", gender = "Any", after } = req.query;
  if (typeof query !== "string" || query.length > 100 || typeof gender !== "string" ||
      !["Any", ...Object.keys(genders)].includes(gender) || (after !== undefined && !isId(after))) throw bad("Invalid search");
  const minAge = numberParam(req.query.minAge, 18), maxAge = numberParam(req.query.maxAge, 120);
  const maxDistance = numberParam(req.query.maxDistance, 10000), limit = numberParam(req.query.limit, 100);
  if (!Number.isInteger(minAge) || !Number.isInteger(maxAge) || minAge < 18 || maxAge > 120 || minAge > maxAge ||
      maxDistance < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw bad("Invalid filters");
  const viewer = new mongoose.Types.ObjectId(req.user.userId);
  const me = await Profile.findOne({ userId: viewer }).select("location").lean().maxTimeMS(5000);
  const match = { userId: { $ne: viewer }, dateOfBirth: { $gt: birthdayCutoff(maxAge + 1), $lte: birthdayCutoff(minAge) } };
  if (after) match._id = { $gt: new mongoose.Types.ObjectId(after) };
  // Case-insensitive equality preserves older gender spellings without regex input.
  if (gender !== "Any") match.$expr = { $in: [{ $toLower: "$gender" }, genders[gender]] };
  const pipeline = [
    { $match: match },
    { $sort: { _id: 1 } },
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", pipeline: [
      { $match: { isActive: true, isVerified: true } }, { $project: { firstName: 1, lastName: 1 } },
    ], as: "member" } },
    { $unwind: "$member" },
    { $lookup: { from: "swipes", let: { target: "$userId" }, pipeline: [
      { $match: { fromUserId: viewer, $expr: { $eq: ["$toUserId", "$$target"] } } },
      { $limit: 1 }, { $project: { _id: 1 } },
    ], as: "swiped" } },
    { $match: { "swiped.0": { $exists: false } } },
    { $set: { name: { $cond: [{ $ne: [{ $ifNull: ["$profileName", ""] }, ""] }, "$profileName",
      { $concat: ["$member.firstName", " ", "$member.lastName"] }] } } },
  ];
  if (query) pipeline.push({ $match: { $expr: { $gte: [{ $indexOfCP: [{ $toLower: "$name" }, { $literal: query.toLowerCase() }] }, 0] } } });
  if ([me?.location?.latitude, me?.location?.longitude].every(Number.isFinite)) {
    const radians = value => ({ $degreesToRadians: value });
    const lat = me.location.latitude, lon = me.location.longitude;
    const haversine = { $add: [
      { $pow: [{ $sin: { $divide: [radians({ $subtract: ["$location.latitude", lat] }), 2] } }, 2] },
      { $multiply: [{ $cos: radians(lat) }, { $cos: radians("$location.latitude") },
        { $pow: [{ $sin: { $divide: [radians({ $subtract: ["$location.longitude", lon] }), 2] } }, 2] }] },
    ] };
    pipeline.push({ $set: { distanceMi: { $cond: [
      { $and: [{ $isNumber: "$location.latitude" }, { $isNumber: "$location.longitude" }] },
      { $round: [{ $multiply: [7917.6, { $asin: { $sqrt: { $min: [1, { $max: [0, haversine] }] } } }] }, 1] }, null,
    ] } } });
    pipeline.push({ $match: { $or: [{ distanceMi: null }, { distanceMi: { $lte: maxDistance } }] } });
  } else pipeline.push({ $set: { distanceMi: null } });
  pipeline.push({ $limit: limit + 1 }, { $project: { userId: 1, name: 1, dateOfBirth: 1, gender: 1, distanceMi: 1, bio: 1, photoUrl: { $arrayElemAt: ["$photos", 0] } } });
  let profiles;
  try { profiles = await Profile.aggregate(pipeline).option({ maxTimeMS: 5000, allowDiskUse: false }); }
  catch (error) {
    if (error.code === 50) throw Object.assign(new Error("Search took too long. Narrow your filters and try again."), { status: 503 });
    throw error;
  }
  if (profiles.length > limit) res.set("X-Next-Cursor", String(profiles[limit - 1]._id));
  const { calculateAge } = require("../controllers/authController");
  res.json(profiles.slice(0, limit).map(p => ({ id: p.userId, name: p.name, age: calculateAge(p.dateOfBirth),
    gender: Object.keys(genders).find(key => genders[key].includes(p.gender.toLowerCase())) || p.gender,
    distanceMi: p.distanceMi, photoUrl: p.photoUrl || null, bio: p.bio || "" })));
}
module.exports = { discover };
