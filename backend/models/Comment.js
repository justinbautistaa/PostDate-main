const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    // Post being commented on
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true
    },

    // Person making the comment
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },

    // Null = normal comment
    // ObjectId = reply to another comment
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Get comments for a post
commentSchema.index({ postId: 1, createdAt: 1 });

// Get replies to a comment
commentSchema.index({ parentCommentId: 1 });

module.exports = mongoose.model("Comment", commentSchema);