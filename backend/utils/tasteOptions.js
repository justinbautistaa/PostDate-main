/**
 * tasteOptions
 * The single source of truth for every chip on the sign-up "Your taste" step
 * and the profile "Your taste" tab. There are two separate lists: personality
 * (who you are) and looking-for (what you want from dating).
 *
 * GET /api/tags serves these lists to the frontend, and every save is checked
 * against them here, so the chips on screen and the values the server accepts
 * can never drift apart. To add, rename or remove a chip, edit it in ONE
 * place: below.
 *
 * ⚠️ Renaming a chip orphans anyone who already picked the old name: it stays
 * stored, but no longer matches a chip on screen. Adding chips is always safe.
 */

// 🎛️ PERSONALITY — the first 12 are the original sign-up chips, so accounts
// made before this list grew to 20 keep working.
const PERSONALITY_OPTIONS = [
  "Coffee dates",
  "Late night talks",
  "Hiking",
  "Live music",
  "Home cooking",
  "Board games",
  "Road trips",
  "Bookworm",
  "Dog person",
  "Cat person",
  "Early riser",
  "Night owl",
  "Homebody",
  "Spontaneous",
  "Foodie",
  "Gym rat",
  "Movie buff",
  "Gamer",
  "Creative type",
  "Hopeless romantic",
];

// 🎛️ LOOKING FOR — roughly ordered from most serious to least, then the
// non-romantic options, then relationship style and current situation.
const LOOKING_FOR_OPTIONS = [
  "Long-term relationship",
  "Marriage",
  "Something serious",
  "Dating to see where it goes",
  "Slow burn",
  "Something casual",
  "Short-term fun",
  "Friends with benefits",
  "Hookups",
  "Friendship first",
  "New friends",
  "Activity partner",
  "Travel buddy",
  "Partner in crime",
  "Cuddle buddy",
  "Open to poly",
  "Ethical non-monogamy",
  "Monogamy only",
  "Still figuring it out",
  "Just got out of something",
];

// 🎛️ HOW MANY A PERSON CAN PICK. Keep the minimum in step with `minSelected`
// on <YourTasteForm> in the frontend.
const LIMITS = {
  minPersonality: 3,
  maxPersonality: 5,
  maxLookingFor: 5,
};

/**
 * Checks a list of chip labels against the allowed ones.
 *   { ok: true, value }     value is de-duplicated, in the order sent
 *   { ok: false, message }  safe to send straight back to the client
 *
 * Anything that isn't a plain string (an object, a number, ...) is rejected
 * outright, which also keeps query-operator objects out of Mongo.
 */
function validateSelection(input, allowed, { min = 0, max = Infinity, label = "options" } = {}) {
  if (!Array.isArray(input) || !input.every((item) => typeof item === "string")) {
    return { ok: false, message: `Invalid ${label}` };
  }

  const allowedSet = new Set(allowed);
  const unique = [...new Set(input)];

  if (unique.some((item) => !allowedSet.has(item))) {
    return { ok: false, message: `Invalid ${label}` };
  }
  if (unique.length < min) {
    return { ok: false, message: `Pick at least ${min} ${label}` };
  }
  if (unique.length > max) {
    return { ok: false, message: `Pick at most ${max} ${label}` };
  }
  return { ok: true, value: unique };
}

/**
 * Sign-up can arrive as JSON (tags is already an array) or as multipart, where
 * every field is text and the list is a JSON string like '["Hiking","Foodie"]'.
 * Returns an array, [] when nothing was sent, or null when it can't be read.
 */
function parseListField(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

module.exports = {
  PERSONALITY_OPTIONS,
  LOOKING_FOR_OPTIONS,
  LIMITS,
  validateSelection,
  parseListField,
};
