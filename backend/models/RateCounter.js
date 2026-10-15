const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  _id: String,
  namespace: String,
  keyHash: String,
  hits: { type: Number, default: 0 },
  resetTime: Date,
}, { versionKey: false });
schema.index({ resetTime: 1 }, { expireAfterSeconds: 0 });
schema.index({ namespace: 1, keyHash: 1 });
module.exports = mongoose.model("RateCounter", schema);
