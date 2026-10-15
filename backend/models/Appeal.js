const mongoose = require("mongoose");

/**
 * Appeal
 * A suspended member asking staff to reinstate their account. Filed through
 * POST /api/appeals (controllers/safetyController.js) — the person can't log
 * in, so that route checks their email + password directly — and decided from
 * the dashboard's Appeals section.
 *
 * `type` only has one value today. It's an enum rather than an assumption so
 * adding another kind (say, appealing a hidden rating) is a one-line change
 * here plus a branch in adminController.decideAppeal.
 */
const appealSchema = new mongoose.Schema(
  {
    // The suspended member
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    type: {
      type: String,
      enum: ["suspension"],
      default: "suspension"
    },

    // What the member wrote
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1000
    },

    status: {
      type: String,
      enum: ["pending", "approved", "denied"],
      default: "pending"
    },

    // Filled in when staff decide
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    decisionNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },

    decidedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// The Appeals section: filter by status, newest first
appealSchema.index({ status: 1, createdAt: -1 });

// One open appeal per member. The controller checks first for a friendly
// message; this partial unique index is what makes it race-proof if two
// requests arrive at the same moment.
appealSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

module.exports = mongoose.model("Appeal", appealSchema);
