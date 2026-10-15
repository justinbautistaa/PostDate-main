const mongoose = require("mongoose");

const likeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Prevent a user from liking the same post more than once
likeSchema.index(
  {
    userId: 1,
    postId: 1
  },
  {
    unique: true
  }
);

// Quickly find likes belonging to a post
likeSchema.index({ postId: 1 });

module.exports = mongoose.model("Like", likeSchema);