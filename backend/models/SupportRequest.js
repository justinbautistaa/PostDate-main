const mongoose = require("mongoose");
module.exports = mongoose.model("SupportRequest", new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  kind: { type: String, enum: ["appeal", "privacy"], required: true },
  message: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ["pending", "resolved"], default: "pending" },
}, { timestamps: true }));
