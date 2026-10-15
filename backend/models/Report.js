const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    // Person reporting something
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // What was reported
    targetType: {
      type: String,
      enum: ["user", "post", "comment", "message"],
      required: true
    },

    // ID of whatever was reported
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    // 🆕 Whose account the report is about. For targetType "user" this is
    // the same as targetId; for a post / comment / message it's the author,
    // looked up when the report is filed (controllers/safetyController.js).
    // It's what lets staff suspend "the person behind this report" in one
    // click no matter what kind of thing was reported.
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    reason: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000
    },

    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved", "dismissed"],
      default: "pending"
    },

    // 🆕 The staff member who last touched it, and what they wrote.
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },

    resolvedAt: {
      type: Date,
      default: null
    },
    memberSeenAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

// Find pending moderation reports
reportSchema.index({ status: 1, createdAt: -1 });

// Find reports made by a user
reportSchema.index({ reporterId: 1 });

// 🆕 Find reports about a user (the Users table's "Reports" column)
reportSchema.index({ reportedUserId: 1 });

module.exports = mongoose.model("Report", reportSchema);
