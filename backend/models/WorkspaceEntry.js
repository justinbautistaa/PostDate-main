const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  kind: { type: String, enum: ["announcement", "note", "plan"], required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  member: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: { type: String, required: true, maxlength: 120 },
  body: { type: String, default: "", maxlength: 2000 },
  audience: { type: String, enum: ["everyone", "members", "staff"], default: "everyone" },
  when: Date,
  done: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ kind: 1, owner: 1, createdAt: -1 });
schema.index({ kind: 1, createdAt: -1 });
module.exports = mongoose.model("WorkspaceEntry", schema);
