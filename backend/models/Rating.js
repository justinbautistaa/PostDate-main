const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    // Person giving the rating
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // Person receiving the rating
    reviewedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // Match through which they interacted
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: true
    },

    ratings: {
      // General rating
      overall: {
        type: Number,
        required: true,
        min: 1,
        max: 5
      },

      // Your custom "spice" rating
      spice: {
        type: Number,
        required: true,
        min: 1,
        max: 5
      },

      // How attentive the person was
      attentiveness: {
        type: Number,
        required: true,
        min: 1,
        max: 5
      },

      // How respectfully they behaved
      respectfulness: {
        type: Number,
        required: true,
        min: 1,
        max: 5
      },

      // How well the two people connected
      chemistry: {
        type: Number,
        required: true,
        min: 1,
        max: 5
      }
    },

    // Written review
    comment: {
      type: String,
      trim: true,
      maxlength: 1000
    },

    // Whether the review can be displayed publicly
    isPublic: {
      type: Boolean,
      default: true
    },

    // 🆕 Moderation. A hidden rating is kept (so a decision can be reversed
    // and audited) but is left out of every average and public listing.
    isHidden: {
      type: Boolean,
      default: false
    },

    hiddenReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },

    hiddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    hiddenAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Used when displaying a user's received ratings
ratingSchema.index({
  reviewedUserId: 1,
  createdAt: -1
});

// Used when displaying ratings written by a user
ratingSchema.index({
  reviewerId: 1,
  createdAt: -1
});

// 🆕 Moderation queue: hidden / visible, newest first
ratingSchema.index({
  isHidden: 1,
  createdAt: -1
});

// Prevent the same user from rating the same person multiple times
ratingSchema.index(
  {
    reviewerId: 1,
    reviewedUserId: 1
  },
  {
    unique: true
  }
);


module.exports = mongoose.model("Rating", ratingSchema);
