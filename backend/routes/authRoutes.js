const express = require("express");
const {
  logout,
  session,
  register,
  login,
  sendVerificationCode,
  verifyCode,
} = require("../controllers/authController");
const { authLimiter } = require("../middleware/rateLimiter");
const { asyncHandler } = require("../middleware/errorHandler");
const { upload, MAX_FILES } = require("../middleware/upload");

const { requireAuth } = require("../middleware/auth");
const { validateRequest } = require("../middleware/security");

const recovery = require("../controllers/recoveryController");

const router = express.Router();

// Mounted at /api in server.js, so these become:
//   POST /api/signup
//   POST /api/auth/login
//   POST /api/verify/send
//   POST /api/verify/confirm
//
// authLimiter (see ../middleware/rateLimiter.js) applies a tighter limit to
// all four — these are the routes most worth brute-forcing.
//
// upload.array on /signup lets the sign-up photo step ride along with the
// rest of the form as multipart/form-data. It's a no-op for a plain JSON
// request (multer only engages for multipart content types), so this
// doesn't change anything for a signup sent without photos.
router.post("/signup", authLimiter, upload.array("photos", MAX_FILES), validateRequest, asyncHandler(register));
router.post("/auth/login", authLimiter, asyncHandler(login));
router.post("/verify/send", authLimiter, asyncHandler(sendVerificationCode));
router.post("/verify/confirm", authLimiter, asyncHandler(verifyCode));

router.get("/auth/session", requireAuth, session);
router.post("/auth/logout", requireAuth, asyncHandler(logout));

router.post("/auth/recovery/request", authLimiter, asyncHandler(recovery.requestRecovery));
router.post("/auth/recovery/verify", authLimiter, asyncHandler(recovery.verifyRecovery));
router.post("/auth/recovery/reset", authLimiter, asyncHandler(recovery.resetPassword));

module.exports = router;
