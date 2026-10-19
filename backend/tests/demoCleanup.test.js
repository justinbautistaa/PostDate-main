const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/User"), Match = require("../models/Match");
const { cleanupDemo } = require("../utils/demoCleanup");
let mongo, demo, real;
beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  [demo, real] = await User.create(["one@demo.postdate.test", "real@example.test"].map(email => ({ email, firstName: "Test", lastName: "User", passwordHash: "retained" })));
  await mongoose.connection.db.collection("demoSeedRuns").insertOne({ _id: "postdate-dashboard-demo-v1", status: "complete", userIds: [demo._id] });
});
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });
test("defaults to preview; explicit cleanup removes only marker-owned demo users and is idempotent", async () => {
  expect(await cleanupDemo()).toMatchObject({ status: "preview", accounts: 1 });
  expect(await User.countDocuments()).toBe(2);
  expect(await cleanupDemo({ apply: true })).toMatchObject({ status: "cleaned", accounts: 1 });
  expect(await User.exists({ _id: demo.id })).toBeNull();
  expect((await User.findById(real.id).select("+passwordHash")).passwordHash).toBe("retained");
  expect(await cleanupDemo({ apply: true })).toEqual({ status: "already_cleaned" });
});
test("refuses mixed real/demo interactions and tampered ownership markers", async () => {
  const match = await Match.create({ user1: demo.id, user2: real.id });
  await expect(cleanupDemo({ apply: true })).rejects.toThrow(/manual review/);
  expect(await User.countDocuments()).toBe(2);
  await Match.deleteOne({ _id: match.id });
  const Swipe = require("../models/Swipe");
  await Swipe.create({ fromUserId: real.id, toUserId: demo.id, action: "like" });
  await expect(cleanupDemo({ apply: true })).rejects.toThrow(/manual review/);
  expect(await Swipe.countDocuments()).toBe(1);
  await Swipe.deleteMany({});
  await mongoose.connection.db.collection("demoSeedRuns").updateOne({}, { $set: { userIds: [real._id] } });
  await expect(cleanupDemo({ apply: true })).rejects.toThrow(/ownership/);
});
