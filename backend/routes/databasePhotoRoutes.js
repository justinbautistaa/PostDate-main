const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Photo = require('../models/Photo');
const Profile = require('../models/Profile');
const User = require('../models/User');
const Match = require('../models/Match');

// Existing database-backed galleries retain /api/photos/<id> references.
// Apply the same access boundary as the current /uploads delivery route.
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.sendStatus(404);
  const photo = await Photo.findById(req.params.id);
  if (!photo) return res.sendStatus(404);
  const reference = `/api/photos/${photo._id}`;
  const profile = await Profile.findOne({ userId: photo.userId, photos: reference }).select('userId discoverable').lean();
  if (!profile) return res.sendStatus(404);
  const me = req.user.userId, owner = String(photo.userId);
  if (me !== owner) {
    if (!await User.exists({ _id: owner, isActive: true, isVerified: true, deletionRequestedAt: null })) return res.sendStatus(404);
    if (!['admin', 'moderator'].includes(req.user.role)) {
      const pair = { $or: [{ user1: me, user2: owner }, { user1: owner, user2: me }] };
      if (await Match.exists({ ...pair, status: { $in: ['blocked', 'unmatched'] } })) return res.sendStatus(404);
      if (profile.discoverable === false && !await Match.exists({ ...pair, status: 'active' })) return res.sendStatus(404);
    }
  }
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  return res.type('jpeg').send(photo.data);
}));
module.exports = router;
