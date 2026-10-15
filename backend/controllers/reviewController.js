const Match = require("../models/Match");
const Rating = require("../models/Rating");
const User = require("../models/User");
const FIELDS = ["overall", "spice", "attentiveness", "respectfulness", "chemistry"];
async function createReview(req, res) {
  const { matchId, ratings, comment = "", isPublic = true } = req.body;
  if (typeof matchId !== "string" || !/^[a-f\d]{24}$/i.test(matchId) || !ratings ||
    FIELDS.some(key => !Number.isInteger(ratings[key]) || ratings[key] < 1 || ratings[key] > 5) ||
    typeof comment !== "string" || comment.trim().length > 1000 || typeof isPublic !== "boolean")
    return res.status(400).json({ message: "Choose all five scores from 1 to 5 and keep your review under 1,000 characters." });
  const me = req.user.userId;
  const match = await Match.findOne({ _id: matchId, status: "active", $or: [{ user1: me }, { user2: me }] }).lean();
  if (!match) return res.status(404).json({ message: "Match unavailable" });
  const partner = String(match.user1) === me ? match.user2 : match.user1;
  if (!await User.exists({ _id: partner, isActive: true })) return res.status(404).json({ message: "Account unavailable" });
  try {
    const review = await Rating.create({ reviewerId: me, reviewedUserId: partner, matchId: match._id,
      ratings: Object.fromEntries(FIELDS.map(key => [key, ratings[key]])), comment: comment.trim(), isPublic });
    return res.status(201).json({ id: String(review._id), reviewed: true });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "You already reviewed this match." });
    throw err;
  }
}
module.exports = { createReview };
