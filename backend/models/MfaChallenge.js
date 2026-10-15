const mongoose = require("mongoose");
const schema = new mongoose.Schema({ tokenHash: { type: String, unique: true }, userId: { type: mongoose.Schema.Types.ObjectId, required: true }, version: Number, enroll: Boolean, secret: String, attempts: { type: Number, default: 0 }, expiresAt: Date });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model("MfaChallenge", schema);
