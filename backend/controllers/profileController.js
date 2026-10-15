const Profile = require("../models/Profile");
const {
  PERSONALITY_OPTIONS,
  LOOKING_FOR_OPTIONS,
  LIMITS,
  validateSelection,
} = require("../utils/tasteOptions");
const { savePhotosToDisk, deletePhotoFile } = require("../utils/photoStorage");

// 🎛️ Account-wide photo cap, independent of the per-request limit in
// middleware/upload.js (MAX_FILES) — that one caps a single upload, this
// one caps the gallery so it can't grow without bound over many uploads.
const MAX_PHOTOS_PER_PROFILE = 30;

/**
 * GET /api/tags
 * Public — no requireAuth. Sign-up step 3 needs the chip lists before an
 * account (and therefore a token) exists. Also returns the pick limits, so
 * the frontend never hard-codes a number the server might enforce
 * differently.
 */
async function getTags(req, res) {
  res.json({
    personality: PERSONALITY_OPTIONS,
    lookingFor: LOOKING_FOR_OPTIONS,
    limits: LIMITS,
  });
}

/**
 * PUT /api/profile/tags
 * Saves the "Your taste" personality chips. Replaces the full list (not a
 * diff), same contract as the mock this replaces — see saveProfileTags in
 * postdateApi.js. No minimum here: sign-up is where a minimum is enforced
 * (client-side); once an account exists, clearing chips back toward zero on
 * this tab is allowed.
 */
async function saveTags(req, res) {
  const result = validateSelection(req.body?.tags, PERSONALITY_OPTIONS, {
    max: LIMITS.maxPersonality,
    label: "personality tags",
  });
  if (!result.ok) return res.status(400).json({ message: result.message });

  const profile = await Profile.findOneAndUpdate(
    { userId: req.user.userId },
    { interests: result.value },
    { new: true, runValidators: true }
  );
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  res.json({ tags: profile.interests });
}

/**
 * PUT /api/profile/looking-for
 * Same shape as saveTags, but for the separate "what are you looking for"
 * list, so editing one never overwrites the other.
 */
async function saveLookingFor(req, res) {
  const result = validateSelection(req.body?.lookingFor, LOOKING_FOR_OPTIONS, {
    max: LIMITS.maxLookingFor,
    label: "looking-for tags",
  });
  if (!result.ok) return res.status(400).json({ message: result.message });

  const profile = await Profile.findOneAndUpdate(
    { userId: req.user.userId },
    { "lookingFor.intents": result.value },
    { new: true, runValidators: true }
  );
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  res.json({ lookingFor: profile.lookingFor.intents });
}

/**
 * POST /api/profile/photos  (multipart, field name "photos")
 * Appends the uploaded photos to the gallery. If the account has never had
 * a photo before, the first one also becomes the avatar — otherwise a
 * freshly verified account would have photos but no way to promote one to
 * be its picture without a separate trip to PUT /api/profile/avatar.
 */
async function uploadPhotos(req, res) {
  const files = req.files ?? [];
  if (files.length === 0) {
    return res.status(400).json({ message: "No photos were sent" });
  }

  const profile = await Profile.findOne({ userId: req.user.userId });
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  if (profile.photos.length + files.length > MAX_PHOTOS_PER_PROFILE) {
    return res.status(400).json({
      message: `You can only keep up to ${MAX_PHOTOS_PER_PROFILE} photos — delete some first`,
    });
  }

  const saved = await savePhotosToDisk(files);
  try {
    // Reserve capacity atomically, so concurrent uploads cannot exceed quota.
    const updated = await Profile.findOneAndUpdate({
      userId: req.user.userId,
      $expr: { $lte: [{ $add: [{ $size: "$photos" }, saved.length] }, MAX_PHOTOS_PER_PROFILE] },
    }, [{ $set: {
      photos: { $concatArrays: ["$photos", saved] },
      avatar: { $ifNull: ["$avatar", saved[0]] },
    } }], { new: true });
    if (!updated) {
      await Promise.all(saved.map((photo) => deletePhotoFile(photo).catch(() => {})));
      return res.status(409).json({ message: "Photo capacity changed. Refresh and try again." });
    }
    return res.status(201).json({ photos: updated.photos, avatar: updated.avatar });
  } catch (err) {
    // A database write can commit even when its acknowledgement is lost.
    // Retain referenced files; if the read also fails, keep files for repair.
    try {
      const current = await Profile.findOne({ userId: req.user.userId }).select("photos").lean();
      await Promise.all(saved.filter(photo => !current?.photos?.includes(photo)).map(photo => deletePhotoFile(photo).catch(() => {})));
    } catch { /* Keep potentially committed photos during database outages. */ }
    throw err;
  }
}

/**
 * DELETE /api/profile/photos/:filename
 * `:filename` is just the last path segment of a stored photo (what
 * "/uploads/<filename>" serves), e.g. "3f9a1c...b2.jpg". Refuses to delete
 * the current avatar (switch to a different one first) or the last photo
 * left, so an account can never end up with a broken avatar or an empty
 * gallery.
 */
async function deletePhoto(req, res) {
  const publicPath = `/uploads/${req.params.filename}`;

  const profile = await Profile.findOne({ userId: req.user.userId });
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  if (!profile.photos.includes(publicPath)) {
    return res.status(404).json({ message: "Photo not found" });
  }
  if (profile.avatar === publicPath) {
    return res
      .status(400)
      .json({ message: "Set a different profile picture before deleting this one" });
  }
  if (profile.photos.length <= 1) {
    return res.status(400).json({ message: "You need at least one photo" });
  }

  // Drop the DB reference first: if the disk delete below fails for some
  // reason other than the file already being gone, an orphan file on disk
  // is a much smaller problem than a photo the UI thinks exists but 404s.
  profile.photos = profile.photos.filter((p) => p !== publicPath);
  await profile.save();
  await deletePhotoFile(publicPath);

  res.json({ photos: profile.photos });
}

/**
 * PUT /api/profile/avatar
 * Body: { photo: "/uploads/<filename>" } — must already be one of this
 * account's own photos. Never accepts an arbitrary path or external URL,
 * so this can't be used to point the avatar at someone else's file.
 */
async function setAvatar(req, res) {
  const { photo } = req.body ?? {};
  if (typeof photo !== "string") {
    return res.status(400).json({ message: "Missing photo" });
  }

  const profile = await Profile.findOne({ userId: req.user.userId });
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  if (!profile.photos.includes(photo)) {
    return res.status(400).json({ message: "Pick one of your own photos" });
  }

  profile.avatar = photo;
  await profile.save();

  res.json({ avatar: profile.avatar });
}

module.exports = { getTags, saveTags, saveLookingFor, uploadPhotos, deletePhoto, setAvatar };
