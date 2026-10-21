const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const sharp = require('sharp');
const { MongoMemoryServer } = require('mongodb-memory-server');
process.env.JWT_SECRET = 'database-photo-test-only-secret-123456789';
const { createApp } = require('../server');
const User = require('../models/User'), Profile = require('../models/Profile');
const Photo = require('../models/Photo'), Match = require('../models/Match');
let mongo, app, owner, viewer, staff, photo, bytes;
const cookie = user => `postdate=${jwt.sign({ userId: user.id, version: 0 }, process.env.JWT_SECRET, { issuer: 'postdate', audience: 'postdate-web', expiresIn: '1h' })}`;
const read = user => request(app).get(`/api/photos/${photo.id}`).set('Cookie', cookie(user));
beforeAll(async () => {
  mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); app = createApp();
  bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'blue' } }).jpeg().toBuffer();
});
beforeEach(async () => {
  [owner, viewer, staff] = await User.create(['user', 'user', 'moderator'].map((role, i) => ({ email: `photo${i}@example.test`, firstName: `Person${i}`, lastName: 'Test', passwordHash: 'unused', role, isVerified: true, emailVerifiedAt: new Date() })));
  photo = await Photo.create({ userId: owner.id, data: bytes });
  await Profile.create({ userId: owner.id, dateOfBirth: new Date('1998-01-01'), gender: 'female', photos: [`/api/photos/${photo.id}`], avatar: `/api/photos/${photo.id}` });
});
afterEach(async () => { await Promise.all(Object.values(mongoose.models).map(model => model.deleteMany({}))); });
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
it('requires authentication and returns the referenced original bytes with private headers', async () => {
  await request(app).get(`/api/photos/${photo.id}`).expect(401);
  const response = await read(owner).expect(200);
  expect(response.body).toEqual(bytes);
  expect(response.headers['content-type']).toContain('image/jpeg');
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  await read(viewer).expect(200);
});
it('hides private galleries from unrelated members while preserving owner, staff and active matches', async () => {
  await Profile.updateOne({ userId: owner.id }, { discoverable: false });
  await read(viewer).expect(404); await read(owner).expect(200); await read(staff).expect(200);
  await Match.create({ user1: owner.id, user2: viewer.id, status: 'active' });
  await read(viewer).expect(200);
});
it.each(['blocked', 'unmatched'])('denies %s pairs even when the profile is discoverable', async status => {
  await Match.create({ user1: owner.id, user2: viewer.id, status });
  await read(viewer).expect(404);
});
it.each([{ isActive: false }, { isVerified: false }, { deletionRequestedAt: new Date() }])('denies an unavailable owner %#', async change => {
  await User.updateOne({ _id: owner.id }, change);
  await read(viewer).expect(404); await read(staff).expect(404);
});
it('refuses orphaned, removed, invalid and missing photo references', async () => {
  await Profile.updateOne({ userId: owner.id }, { photos: [] });
  await read(owner).expect(404);
  await request(app).get('/api/photos/not-an-id').set('Cookie', cookie(owner)).expect(404);
  await request(app).get(`/api/photos/${new mongoose.Types.ObjectId()}`).set('Cookie', cookie(owner)).expect(404);
});
