const crypto = require("crypto");
const { BSON } = require("mongoose").mongo;
const MAGIC = Buffer.from("POSTDATE1");
function keyFromEnvironment() {
  const value = process.env.BACKUP_ENCRYPTION_KEY;
  if (!/^[a-f0-9]{64}$/i.test(value || "")) throw new Error("BACKUP_ENCRYPTION_KEY must be a random 32-byte hexadecimal key");
  return Buffer.from(value, "hex");
}
async function snapshot(db) {
  const collections = [];
  for (const { name, type } of await db.listCollections().toArray()) {
    if (type !== "collection" || name.startsWith("system.") || name === "ratecounters") continue;
    collections.push({ name, documents: await db.collection(name).find({}).toArray(), indexes: await db.collection(name).indexes() });
  }
  return { format: 1, createdAt: new Date(), collections };
}
function encrypt(snapshotData, key) {
  const plain = Buffer.from(BSON.EJSON.stringify(snapshotData, { relaxed: false }));
  if (plain.length > 64 * 1024 * 1024) throw new Error("Backup exceeds the 64 MiB application-backup limit; use managed database backups");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(MAGIC);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
}
function decrypt(data, key) {
  if (data.length < MAGIC.length + 28 || !data.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Invalid backup format");
  const offset = MAGIC.length;
  const cipher = crypto.createDecipheriv("aes-256-gcm", key, data.subarray(offset, offset + 12));
  cipher.setAAD(MAGIC);
  cipher.setAuthTag(data.subarray(offset + 12, offset + 28));
  const plain = Buffer.concat([cipher.update(data.subarray(offset + 28)), cipher.final()]);
  const result = BSON.EJSON.parse(plain.toString("utf8"), { relaxed: false });
  if (Number(result.format) !== 1 || !Array.isArray(result.collections)) throw new Error("Invalid backup contents");
  return result;
}
async function restoreToTestDatabase(db, data) {
  if (!/restore_test/i.test(db.databaseName)) throw new Error("Restore is restricted to a database named with restore_test");
  if ((await db.listCollections().toArray()).length) throw new Error("Restore requires an empty test database");
  for (const collection of data.collections) {
    if (!/^[a-zA-Z0-9_-]+$/.test(collection.name)) throw new Error("Invalid collection name");
    await db.createCollection(collection.name);
    const target = db.collection(collection.name);
    if (collection.documents.length) await target.insertMany(collection.documents);
    for (const index of collection.indexes) {
      if (index.name === "_id_") continue;
      const { key, name, unique, sparse, expireAfterSeconds, partialFilterExpression, collation } = index;
      const options = Object.fromEntries(Object.entries({ name, unique, sparse, expireAfterSeconds, partialFilterExpression, collation }).filter(([, value]) => value !== undefined));
      await target.createIndex(key, options);
    }
  }
}
module.exports = { keyFromEnvironment, snapshot, encrypt, decrypt, restoreToTestDatabase };
