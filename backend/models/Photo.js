const mongoose = require("mongoose");
module.exports = mongoose.model("Photo", new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  data: { type: Buffer, required: true },
}, { timestamps: true }));
