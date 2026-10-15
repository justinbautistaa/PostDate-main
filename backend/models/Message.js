const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // Conversation this message belongs to
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: true
    },

    // Person who sent the message
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // Person who receives it
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
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

// Messages in chronological order for a match
messageSchema.index({ matchId: 1, createdAt: 1 });
messageSchema.index({ matchId: 1, _id: -1 });

// Useful for unread-message queries
messageSchema.index({ receiverId: 1, read: 1 });

module.exports = mongoose.model("Message", messageSchema);
