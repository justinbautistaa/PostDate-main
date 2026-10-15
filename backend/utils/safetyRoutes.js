const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { asyncHandler } = require("../middleware/errorHandler");
const { createReport, createAppeal } = require("../controllers/safetyController");

const router = express.Router();

// Mounted at /api in server.js, so these become:
//   POST /api/reports   a signed-in member reports a profile / post / comment / message
//   POST /api/appeals   a suspended member appeals (email + password in the body)
//
// Appeals get the tight authLimiter because they check a password, exactly
// like log-in does. Reports ride on the general /api limiter from server.js.
router.post("/reports", requireAuth, asyncHandler(createReport));
router.post("/appeals", authLimiter, asyncHandler(createAppeal));

module.exports = router;
