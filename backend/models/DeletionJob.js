const mongoose = require("mongoose");
const schema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true }, photos: [String], leaseUntil: { type: Date, default: () => new Date(0) }, attempts: { type: Number, default: 0 } }, { timestamps: true });
module.exports = mongoose.model("DeletionJob", schema);
