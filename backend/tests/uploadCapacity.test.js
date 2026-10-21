const express = require('express');
const request = require('supertest');
const { EventEmitter } = require('events');
const { createUploadCapacity } = require('../middleware/uploadCapacity');
const { upload } = require('../middleware/upload');
const { errorHandler } = require('../middleware/errorHandler');

test('signup and profile uploads share capacity; JSON requests and health remain available', async () => {
  const app = express();
  const capacity = createUploadCapacity();
  let started, finish;
  const entered = new Promise(resolve => { started = resolve; });
  const held = new Promise(resolve => { finish = resolve; });
  const handler = async (_req, res) => { started(); await held; res.json({ ok: true }); };
  app.post('/signup', capacity(upload.array('photos', 10), handler));
  app.post('/profile', capacity(upload.array('photos', 10), (_req, res) => res.json({ ok: true })));
  app.get('/healthz', (_req, res) => res.json({ status: 'ready' }));
  app.use(errorHandler);
  const first = request(app).post('/signup').attach('photos', Buffer.from('fixture'), 'photo.jpg').then(r => r);
  try {
    await entered;
    const results = await Promise.all(Array.from({ length: 4 }, () => request(app).post('/profile').attach('photos', Buffer.from('fixture'), 'photo.jpg')));
    expect(results.map(r => r.status)).toEqual([503, 503, 503, 503]);
    expect(results.every(r => r.headers['retry-after'] === '5')).toBe(true);
    expect((await request(app).get('/healthz')).status).toBe(200);
    expect((await request(app).post('/profile').send({})).status).toBe(200);
  } finally { finish(); await first; }
  expect((await request(app).post('/profile').attach('photos', Buffer.from('fixture'), 'photo.jpg')).status).toBe(200);
});

test('parser errors and validation failures release capacity', async () => {
  const app = express();
  const capacity = createUploadCapacity();
  app.post('/invalid', capacity(upload.array('photos', 10), () => { throw new Error('must not run'); }, (_req, res) => res.status(400).end()));
  app.post('/upload', capacity(upload.array('photos', 10), (_req, res) => res.json({ ok: true })));
  app.use(errorHandler);
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect((await request(app).post('/upload').attach('photos', Buffer.from('fixture'), 'bad.txt')).status).toBe(400);
    expect((await request(app).post('/invalid').attach('photos', Buffer.from('fixture'), 'photo.jpg')).status).toBe(400);
    expect((await request(app).post('/upload').attach('photos', Buffer.from('fixture'), 'photo.jpg')).status).toBe(200);
  } finally { log.mockRestore(); }
});

test('disconnect during conversion retains capacity until the handler settles', async () => {
  const capacity = createUploadCapacity();
  const parse = (_req, _res, next) => next();
  let finish, started;
  const entered = new Promise(resolve => { started = resolve; });
  const held = new Promise(resolve => { finish = resolve; });
  const res = new EventEmitter();
  const req = { is: () => true };
  const next = jest.fn();
  capacity(parse, async () => { started(); await held; })(req, res, next);
  await entered;
  res.emit('close');
  const busy = { set: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
  capacity(parse, jest.fn())(req, busy, next);
  expect(busy.status).toHaveBeenCalledWith(503);
  finish();
  await new Promise(resolve => setImmediate(resolve));
  const subsequent = new EventEmitter();
  const handler = jest.fn();
  capacity(parse, handler)(req, subsequent, next);
  await new Promise(resolve => setImmediate(resolve));
  expect(handler).toHaveBeenCalledTimes(1);
  expect(next).not.toHaveBeenCalled();
});
