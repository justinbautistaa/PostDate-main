const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const member = require("../controllers/memberController");

router.use(["/profile/details", "/discover", "/matches/history"], requireAuth);
router.put("/profile/details", asyncHandler(member.updateDetails));
router.get("/discover", asyncHandler(member.discover));
router.post("/discover/like", asyncHandler((req, res) => member.recordSwipe(req, res, "like")));
router.post("/discover/pass", asyncHandler((req, res) => member.recordSwipe(req, res, "pass")));
router.get("/matches/history", asyncHandler(member.matchHistory));
router.post("/reviews", requireAuth, asyncHandler(require("../controllers/reviewController").createReview));
module.exports = router;
