const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { seedDemoOnce } = require("../utils/seedDemoOnce");
const User = require("../models/User");
let mongo;
const previous = { ...process.env };
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGO_URI);
});
afterAll(async () => { process.env = previous; await mongoose.disconnect(); await mongo.stop(); });
test("seeding is opt-in, verifies exact counts, preserves real accounts and runs only once", async () => {
  const real = await User.create({ email: "existing@example.test", firstName: "Existing", lastName: "Account", passwordHash: "unchanged", role: "user" });
  process.env.SEED_DEMO_DATA = "false";
  await seedDemoOnce();
  expect(await User.countDocuments()).toBe(1);
  process.env.SEED_DEMO_DATA = "true";
  const counts = await seedDemoOnce();
  expect(counts).toMatchObject({ members: 64, moderators: 2, matches: 110, reports: 28, appeals: 5 });
  expect(counts.ratings).toBeGreaterThan(0);
  expect(await seedDemoOnce()).toEqual(counts);
  expect(await User.countDocuments()).toBe(67);
  expect((await User.findById(real.id).select("+passwordHash")).passwordHash).toBe("unchanged");
  const profiles = await require("../models/Profile").find({}).lean();
  expect(profiles).toHaveLength(64);
  expect(profiles.every(profile => profile.discoverable === false)).toBe(true);
});
test("an incomplete run stops without resetting or duplicating records", async () => {
  const runs = mongoose.connection.db.collection("demoSeedRuns");
  await runs.updateOne({ _id: "postdate-dashboard-demo-v1" }, { $set: { status: "failed" } });
  await expect(seedDemoOnce()).rejects.toThrow(/manual review/);
  expect(await User.countDocuments()).toBe(67);
});
test("the full demo dataset survives encrypted backup and restore into a separate empty test database", async () => {
  const { snapshot, encrypt, decrypt, restoreToTestDatabase } = require("../utils/backup");
  const key = require("crypto").randomBytes(32);
  const source = mongoose.connection.db;
  const data = decrypt(encrypt(await snapshot(source), key), key);
  const target = mongoose.connection.getClient().db("postdate_restore_test");
  await restoreToTestDatabase(target, data);
  for (const collection of data.collections) {
    expect(await target.collection(collection.name).countDocuments()).toBe(collection.documents.length);
  }
  expect(await target.collection("users").countDocuments()).toBe(67);
  expect(await target.collection("matches").countDocuments()).toBe(110);
  expect(await target.collection("reports").countDocuments()).toBe(28);
});
