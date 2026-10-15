const crypto = require("crypto");
const Counter = require("../models/RateCounter");

class MongoRateStore {
  constructor(namespace) { this.namespace = namespace; this.localKeys = false; this.prefix = `${namespace}:`; }
  init(options) { this.windowMs = options.windowMs; }
  hash(key) { return crypto.createHmac("sha256", process.env.JWT_SECRET).update(key).digest("hex"); }
  async increment(key) {
    const keyHash = this.hash(key);
    const bucket = Math.floor(Date.now() / this.windowMs);
    const id = `${this.namespace}:${keyHash}:${bucket}`;
    const resetTime = new Date((bucket + 1) * this.windowMs);
    const update = { $inc: { hits: 1 }, $setOnInsert: { namespace: this.namespace, keyHash, resetTime } };
    let result;
    try { result = await Counter.findOneAndUpdate({ _id: id }, update, { new: true, upsert: true }); }
    catch (err) {
      if (err.code !== 11000) throw err;
      result = await Counter.findOneAndUpdate({ _id: id }, { $inc: { hits: 1 } }, { new: true });
    }
    return { totalHits: result.hits, resetTime: result.resetTime };
  }
  async decrement(key) {
    const bucket = Math.floor(Date.now() / this.windowMs);
    await Counter.updateOne({ _id: `${this.namespace}:${this.hash(key)}:${bucket}`, hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }
  async resetKey(key) { await Counter.deleteMany({ namespace: this.namespace, keyHash: this.hash(key) }); }
}
module.exports = MongoRateStore;
