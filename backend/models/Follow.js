const mongoose = require("mongoose");

const followSchema = new mongoose.Schema(
  {
    // Person doing the following
    followerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // Person being followed
    followingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate follows
followSchema.index(
  {
    followerId: 1,
    followingId: 1
  },
  {
    unique: true
  }
);

// Find a person's followers
followSchema.index({
  followingId: 1,
  createdAt: -1
});

// Find who a person is following
followSchema.index({
  followerId: 1,
  createdAt: -1
});

module.exports = mongoose.model("Follow", followSchema);