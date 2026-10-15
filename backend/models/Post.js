const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    // Person who created the post
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    content: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: ""
    },

    // Supports images and videos
    media: [
      {
        type: {
          type: String,
          enum: ["image", "video"],
          required: true
        },

        url: {
          type: String,
          required: true
        }
      }
    ],

    visibility: {
    type: String,
    enum: ["public", "followers", "matches", "private"],
    default: "public"
    },

    // Cached counters
    // These make displaying post feeds faster.
    likesCount: {
      type: Number,
      default: 0
    },

    commentsCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// User's posts, newest first
postSchema.index({ userId: 1, createdAt: -1 });

// Feed queries
postSchema.index({ visibility: 1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);