const router = require("express").Router();
const path = require("path");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const Profile = require("../models/Profile"), User = require("../models/User"), Match = require("../models/Match");
const { UPLOAD_DIR } = require("../utils/photoStorage");
const { validFilename, isCloudStorage, cloudPhotoUrl } = require("../utils/cloudPhotos");
router.get("/uploads/:filename", requireAuth, asyncHandler(async (req, res, next) => {
  if (!validFilename(req.params.filename)) return res.sendStatus(404);
  const profile = await Profile.findOne({ photos: `/uploads/${req.params.filename}` }).select("userId discoverable").lean();
  if (!profile) return res.sendStatus(404);
  const me = req.user.userId, owner = String(profile.userId);
  if (me !== owner) {
    if (!await User.exists({ _id: owner, isActive: true, isVerified: true, deletionRequestedAt: null })) return res.sendStatus(404);
    if (!["admin", "moderator"].includes(req.user.role)) {
      const pair = { $or: [{ user1: me, user2: owner }, { user1: owner, user2: me }] };
      if (await Match.exists({ ...pair, status: { $in: ["blocked", "unmatched"] } })) return res.sendStatus(404);
      if (profile.discoverable === false && !await Match.exists({ ...pair, status: "active" })) return res.sendStatus(404);
    }
  }
  res.set({ "Cache-Control": "private, no-store", "Cross-Origin-Resource-Policy": "cross-origin", "X-Content-Type-Options": "nosniff" });
  if (isCloudStorage()) {
    const response = await fetch(cloudPhotoUrl(req.params.filename), { signal: AbortSignal.timeout(15000), redirect: "error" });
    if (!response.ok) return res.sendStatus(response.status === 404 ? 404 : 503);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 8 * 1024 * 1024) return res.sendStatus(503);
    return res.type("image/webp").send(bytes);
  }
  res.sendFile(path.join(UPLOAD_DIR, req.params.filename), { cacheControl: false }, error => { if (error) next(error); });
}));
module.exports = router;
