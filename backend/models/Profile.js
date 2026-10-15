const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    discoverable: { type: Boolean, default: true },
    // Links this profile to the User account
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    // Name displayed on the dating profile
    profileName: {
      type: String,
      trim: true,
      maxlength: 50
    },

    // Used to calculate the user's current age
    dateOfBirth: {
      type: Date,
      required: true
    },

    gender: {
      type: String,
      required: true,
      trim: true
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 1000
    },

    location: {
      city: {
        type: String,
        trim: true
      },

      country: {
        type: String,
        trim: true
      }
    },

    // Personality chips — "Your taste" tab. Validated against
    // utils/tasteOptions.js PERSONALITY_OPTIONS on every write.
    interests: {
      type: [String],
      default: []
    },

    lookingFor: {
      genders: {
        type: [String],
        default: []
      },

      minAge: {
        type: Number,
        min: 18
      },

      maxAge: {
        type: Number,
        min: 18
      },

      // "Looking for" chips — what the person wants from dating, kept
      // separate from `interests` (personality) so the two can be edited
      // independently. Validated against LOOKING_FOR_OPTIONS.
      intents: {
        type: [String],
        default: []
      }
    },

    // Every photo the user has ever uploaded, newest last. Each entry is a
    // public path served by the backend, e.g. "/uploads/<random>.jpg" — see
    // utils/photoStorage.js. Deleting a photo removes it from this array
    // (and the file on disk); it can't be the current avatar or the last
    // photo left (see profileController.deletePhoto).
    photos: {
      type: [String],
      default: []
    },

    // The photo currently shown as the profile picture. Always one of the
    // entries in `photos`, or null before the first upload. Kept as its own
    // field (rather than "photos[0]") so changing it doesn't reorder the
    // gallery the photos tab shows.
    avatar: {
      type: String,
      default: null
    },

    followersCount: {
      type: Number,
      default: 0
    },

    followingCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Profile", profileSchema);
