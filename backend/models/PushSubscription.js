const mongoose = require("mongoose");
const schema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, endpoint: { type: String, required: true, unique: true }, keys: { auth: String, p256dh: String }, sessionVersion: { type: Number, required: true } }, { timestamps: true });
schema.index({ userId: 1 });
module.exports = mongoose.model("PushSubscription", schema);
