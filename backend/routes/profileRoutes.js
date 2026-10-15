const express = require("express");
const {
  getTags,
  saveTags,
  saveLookingFor,
  uploadPhotos,
  deletePhoto,
  setAvatar,
} = require("../controllers/profileController");
const { requireAuth } = require("../middleware/auth");
const { upload, MAX_FILES } = require("../middleware/upload");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

// Mounted at /api in server.js, so these become:
//   GET    /api/tags
//   PUT    /api/profile/tags
//   PUT    /api/profile/looking-for
//   POST   /api/profile/photos
//   DELETE /api/profile/photos/:filename
//   PUT    /api/profile/avatar
//
// generalLimiter (applied to all of /api in server.js) covers rate limiting
// here — nothing extra needed on these routes.

// Public: sign-up step 3 needs the chip lists before an account exists.
router.get("/tags", asyncHandler(getTags));

router.put("/profile/tags", requireAuth, asyncHandler(saveTags));
router.put("/profile/looking-for", requireAuth, asyncHandler(saveLookingFor));

router.post(
  "/profile/photos",
  requireAuth,
  upload.array("photos", MAX_FILES),
  asyncHandler(uploadPhotos)
);
router.delete("/profile/photos/:filename", requireAuth, asyncHandler(deletePhoto));
router.put("/profile/avatar", requireAuth, asyncHandler(setAvatar));

module.exports = router;
