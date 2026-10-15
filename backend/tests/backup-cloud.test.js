const crypto = require("crypto");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { snapshot, encrypt, decrypt, restoreToTestDatabase } = require("../utils/backup");
const cloud = require("../utils/cloudPhotos");
jest.setTimeout(120000);
test("encrypted backups restore IDs, dates, records and unique indexes into an empty test database", async () => {
  const mongo = await MongoMemoryServer.create();
  const client = new mongoose.mongo.MongoClient(mongo.getUri());
  try {
    await client.connect();
    const source = client.db("source"), target = client.db("postdate_restore_test");
    const record = { _id: new mongoose.Types.ObjectId(), email: "private@example.com", createdAt: new Date("2026-01-01") };
    await source.collection("members").insertOne(record);
    await source.collection("members").createIndex({ email: 1 }, { unique: true });
    const key = crypto.randomBytes(32), encrypted = encrypt(await snapshot(source), key);
    expect(encrypted.toString()).not.toContain(record.email);
    expect(() => decrypt(encrypted, crypto.randomBytes(32))).toThrow();
    const modified = Buffer.from(encrypted); modified[modified.length - 1] ^= 1;
    expect(() => decrypt(modified, key)).toThrow();
    const recovered = decrypt(encrypted, key);
    await expect(restoreToTestDatabase(client.db("production"), recovered)).rejects.toThrow("restore_test");
    await restoreToTestDatabase(target, recovered);
    const restored = await target.collection("members").findOne({ _id: record._id });
    expect(restored).toEqual(record);
    await expect(target.collection("members").insertOne({ email: record.email })).rejects.toMatchObject({ code: 11000 });
    await expect(restoreToTestDatabase(target, recovered)).rejects.toThrow("empty");
  } finally { await client.close(); await mongo.stop(); }
});
test("Cloudinary requests are signed and never transmit the API secret", async () => {
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "private-secret";
  const name = `${"a".repeat(32)}.webp`;
  const original = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ public_id: `postdate/${"a".repeat(32)}`, format: "webp" }) });
  try {
    await cloud.uploadCloudPhoto(name, Buffer.from("encoded-image"));
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.cloudinary.com/v1_1/test-cloud/image/upload");
    const fields = Object.fromEntries(options.body.entries());
    expect(fields.api_key).toBe("test-key");
    expect(fields.api_secret).toBeUndefined();
    const parameters = Object.entries(fields).filter(([key]) => !["api_key", "signature", "file"].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&");
    expect(fields.signature).toBe(crypto.createHash("sha256").update(parameters + "private-secret").digest("hex"));
    expect(fields.type).toBe("authenticated");
    const download = new URL(cloud.cloudPhotoUrl(name));
    expect(download.hostname).toBe("api.cloudinary.com");
    expect(download.searchParams.get("type")).toBe("authenticated");
    expect(Number(download.searchParams.get("expires_at")) - Number(download.searchParams.get("timestamp"))).toBe(60);
    expect(download.searchParams.has("api_secret")).toBe(false);
    expect(() => cloud.cloudPhotoUrl("../secret")).toThrow();
  } finally { global.fetch = original; delete process.env.CLOUDINARY_CLOUD_NAME; delete process.env.CLOUDINARY_API_KEY; delete process.env.CLOUDINARY_API_SECRET; }
});
