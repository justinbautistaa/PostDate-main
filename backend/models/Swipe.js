const mongoose = require("mongoose");

const swipeSchema = new mongoose.Schema(
  {
    // Person performing the swipe
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // Person being swiped on
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // What the user decided
    action: {
      type: String,
      enum: ["like", "pass"],
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Helps find a user's swipes
swipeSchema.index({ fromUserId: 1, createdAt: -1 });

// Helps find whether someone has swiped on a user
swipeSchema.index({ toUserId: 1 });

swipeSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });

module.exports = mongoose.model("Swipe", swipeSchema);