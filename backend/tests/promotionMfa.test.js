const request = require('supertest'), mongoose = require('mongoose'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), OTPAuth = require('otpauth');
const { MongoMemoryServer } = require('mongodb-memory-server');
process.env.JWT_SECRET = 'promotion-mfa-test-only-secret-123456789';
process.env.MFA_ENCRYPTION_KEY = 'b'.repeat(64);
const User = require('../models/User');
const mfa = require('../utils/mfa');
let mongo, app, admin, member, originalEnv;
const password = 'PromotionTestPassword123';
const cookie = (user, verified = false) => `__Host-postdate=${jwt.sign({ userId: user.id, version: user.sessionVersion || 0, mfaVerified: verified }, process.env.JWT_SECRET, { issuer: 'postdate', audience: 'postdate-web', expiresIn: '1h' })}`;
const call = (method, path, session) => {
  const r = request(app)[method]('/api' + path).set('X-Postdate-Request', '1');
  return session ? r.set('Cookie', session) : r;
};
const promote = role => call('patch', `/admin/users/${member.id}/role`, cookie(admin, true)).send({ role });
const login = () => call('post', '/auth/login').send({ email: member.email, password });
beforeAll(async () => {
  mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri());
  app = require('../server').createApp();
});
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.models).map(model => model.deleteMany({})));
  [admin, member] = await User.create(['admin', 'user'].map((role, i) => ({ email: `promotion${i}@example.test`, firstName: 'Test', lastName: 'Person', role, isVerified: true, emailVerifiedAt: new Date(), passwordHash: bcrypt.hashSync(password, 4) })));
  originalEnv = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
});
afterEach(() => { process.env.NODE_ENV = originalEnv; });
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test.each(['admin', 'moderator'])('promotion to %s permits login and an existing session, with an MFA recommendation', async role => {
  const existing = cookie(member);
  await promote(role).expect(200);
  expect((await User.findById(member.id).select('+mfaEnrollmentDeferred')).mfaEnrollmentDeferred).toBe(true);
  await call('get', '/auth/session', existing).expect(200);
  await call('get', '/admin/overview', existing).expect(200);
  const result = await login().expect(200);
  expect(result.body.role).toBe(role); expect(result.body.mfaRequired).toBeUndefined();
  const session = result.headers['set-cookie'][0].split(';')[0];
  expect((await call('get', '/auth/mfa/status', session).expect(200)).body).toMatchObject({ enabled: false, required: false, recommended: true });
});
test('voluntary enrollment removes the deferral, revokes old sessions and requires MFA on future login', async () => {
  await promote('moderator').expect(200);
  const session = (await login()).headers['set-cookie'][0].split(';')[0];
  const pending = (await call('post', '/auth/mfa/enroll', session).send({ password }).expect(200)).body;
  const enabled = await call('post', '/auth/mfa/verify').send({ challenge: pending.challenge, code: new OTPAuth.TOTP({ secret: pending.secret }).generate() }).expect(200);
  expect((await User.findById(member.id).select('+mfaEnrollmentDeferred')).mfaEnrollmentDeferred).toBe(false);
  await call('get', '/auth/session', session).expect(401);
  const verified = enabled.headers['set-cookie'][0].split(';')[0];
  expect((await call('get', '/auth/mfa/status', verified)).body).toMatchObject({ enabled: true, recommended: false });
  expect((await login()).body).toMatchObject({ mfaRequired: true, mfaSetupRequired: false });
  await call('post', '/auth/mfa/disable', verified).send({ password, code: enabled.body.recoveryCodes[0] }).expect(403);
});
test('promotion preserves an already enabled authenticator and still rejects a password-only session', async () => {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  const encrypted = mfa.encrypt(secret);
  await User.updateOne({ _id: member.id }, { mfaEnabled: true, mfaSecret: encrypted, mfaRecoveryHashes: ['preserved'] });
  await promote('admin').expect(200);
  expect((await login()).body).toMatchObject({ mfaRequired: true, mfaSetupRequired: false });
  await call('get', '/auth/session', cookie(member)).expect(401);
  const kept = await User.findById(member.id).select('+mfaSecret +mfaRecoveryHashes');
  expect(kept.mfaSecret).toBe(encrypted); expect(kept.mfaRecoveryHashes).toEqual(['preserved']);
});
test('members cannot grant their own promotion or deferred enrollment', async () => {
  await call('patch', `/admin/users/${member.id}/role`, cookie(member)).send({ role: 'admin', mfaEnrollmentDeferred: true }).expect(403);
  expect((await User.findById(member.id).select('+mfaEnrollmentDeferred')).mfaEnrollmentDeferred).toBe(false);
});
test('demotion clears the enrollment deferral', async () => {
  await promote('moderator').expect(200);
  await promote('user').expect(200);
  expect((await User.findById(member.id).select('+mfaEnrollmentDeferred')).mfaEnrollmentDeferred).toBe(false);
});
