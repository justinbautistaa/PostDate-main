const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // Person receiving notification
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    type: {
      type: String,
        enum: [
        "match",
        "message",
        "like",
        "follow",
        "comment",
        "rating",
        "system"
        ],
      required: true
    },

    // User who triggered the notification
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    // ID of related object
    // For example: matchId, postId, ratingId, etc.
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },

    message: {
      type: String,
      trim: true,
      maxlength: 500
    },

    read: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Get user's newest notifications
notificationSchema.index({
  userId: 1,
  createdAt: -1
});

// Quickly find unread notifications
notificationSchema.index({
  userId: 1,
  read: 1
});

module.exports = mongoose.model("Notification", notificationSchema);