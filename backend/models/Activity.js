const mongoose = require("mongoose");
module.exports = mongoose.model("Activity", new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  role: String,
  method: String,
  path: String,
  status: Number,
  category: { type: String, enum: ["server", "security", "moderation"] },
  createdAt: { type: Date, default: Date.now, expires: 2592000 },
}));
