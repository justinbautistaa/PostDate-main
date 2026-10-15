const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const admin = require("../controllers/adminController");

const router = express.Router();

// Mounted at /api in server.js, so these become /api/admin/...
//
// ONE gate in front of everything below: you must be logged in AND be a
// moderator or an admin. A route added to this file can't forget it. Routes
// that are admin-only add requireRole("admin") on top of that.
router.use("/admin", requireAuth, requireRole("admin", "moderator"));

// Header counter + sidebar badges (polled)
router.get("/admin/overview", asyncHandler(admin.getOverview));

// Statistics
router.get("/admin/statistics", asyncHandler(admin.getStatistics));

// Users
router.get("/admin/users", asyncHandler(admin.listUsers));
router.post("/admin/users/:id/suspend", asyncHandler(admin.suspendUser));
router.post("/admin/users/:id/reinstate", asyncHandler(admin.reinstateUser));
router.patch("/admin/users/:id/role", requireRole("admin"), asyncHandler(admin.setUserRole));

// Reports
router.get("/admin/reports", asyncHandler(admin.listReports));
router.patch("/admin/reports/:id", asyncHandler(admin.updateReport));

// Ratings
router.get("/admin/ratings", asyncHandler(admin.listRatings));
router.patch("/admin/ratings/:id", asyncHandler(admin.setRatingHidden));

// Appeals
router.get("/admin/appeals", asyncHandler(admin.listAppeals));
router.post("/admin/appeals/:id/decision", asyncHandler(admin.decideAppeal));

// Mod activity — admins only
router.get("/admin/activity", requireRole("admin"), asyncHandler(admin.listActivity));

module.exports = router;
