const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
process.env.JWT_SECRET = 'password-attempt-tests-only-secret-long-enough';
const { createApp } = require('../server');
const User = require('../models/User');
const Bucket = require('../models/RequestBucket');
const { reservePasswordAttempt, WINDOW_MS } = require('../utils/passwordAttempts');
let mongo, app;
const email = 'limited@example.test', password = 'CorrectPassword123!';
const login = (value = 'WrongPassword123!', address = email) => request(app).post('/api/auth/login').set('X-Postdate-Request','1').send({ email: address, password: value });
beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); await Bucket.init(); app = createApp(); });
afterEach(async () => { await User.deleteMany({}); await Bucket.deleteMany({}); });
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });
test('five incorrect passwords cause the next attempt to return 429 with retry timing', async () => {
  await User.create({ email, firstName:'Test', lastName:'Member', passwordHash:await bcrypt.hash(password,4), isVerified:true, emailVerifiedAt:new Date() });
  for(let i=0;i<5;i++) expect((await login()).status).toBe(401);
  const blocked = await login(password, ' LIMITED@example.test ');
  expect(blocked.status).toBe(429);
  expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  expect(blocked.body.retryAfter).toBeLessThanOrEqual(900);
  expect(blocked.body.message).toMatch(/incorrect login attempts/);
});
test('correct passwords do not consume the failure budget', async () => {
  await User.create({ email, firstName:'Test', lastName:'Member', passwordHash:await bcrypt.hash(password,4), isVerified:true, emailVerifiedAt:new Date() });
  for(let i=0;i<7;i++) expect((await login(password)).status).toBe(200);
  for(let i=0;i<5;i++) expect((await login()).status).toBe(401);
  expect((await login()).status).toBe(429);
});
test('parallel guesses and unknown accounts have the same five-attempt limit', async () => {
  const responses = await Promise.all(Array.from({length:10},()=>login()));
  expect(responses.filter(r=>r.status===401)).toHaveLength(5);
  expect(responses.filter(r=>r.status===429)).toHaveLength(5);
  expect((await login('WrongPassword123!','another@example.test')).status).toBe(401);
  expect((await Bucket.findOne()).key).not.toContain(email);
});
test('the budget becomes available in the next window without waiting for TTL deletion', async () => {
  const now = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS + 100;
  for(let i=0;i<5;i++) expect((await reservePasswordAttempt(email,now)).allowed).toBe(true);
  expect((await reservePasswordAttempt(email,now)).allowed).toBe(false);
  expect((await reservePasswordAttempt(email,now+WINDOW_MS)).allowed).toBe(true);
});
