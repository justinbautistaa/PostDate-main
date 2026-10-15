const multer = require("multer");
const crypto = require("crypto");

/**
 * upload
 * Multer instance used on any route that accepts photo files (sign-up's
 * photo step, and POST /api/profile/photos). Buffers files in memory rather
 * than writing them straight to disk, so a request that fails validation
 * elsewhere (e.g. sign-up's other fields) never leaves orphaned files behind
 * — see utils/photoStorage.js, which is what actually commits buffers to
 * backend/uploads/ once a request is known to be good.
 *
 * 🎛️ MAX_FILE_BYTES / MAX_FILES — raise these if 5MB or 10 photos per
 * request feels too tight for real phone photos.
 */
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB per photo
const MAX_FILES = 10; // per request — see MAX_PHOTOS_PER_PROFILE in profileController for the account-wide cap

// Only these are accepted. Never trust the client's filename or the
// extension on it — the client MIME label is only an initial filter. photoStorage.js must decode
// and re-encode the bytes before storage.
const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function fileFilter(req, file, cb) {
  if (!EXT_BY_MIME[file.mimetype]) {
    // Picked up by errorHandler.js (matched on this exact message) and
    // turned into a 400 rather than the generic 500.
    return cb(new Error("UNSUPPORTED_FILE_TYPE"));
  }
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES, fields: 20, fieldSize: 16384, parts: 30 },
  fileFilter,
});

/** A random, unguessable filename with a trusted extension — never derived from user input. */
function randomFilename(mimetype) {
  return `${crypto.randomBytes(16).toString("hex")}${EXT_BY_MIME[mimetype] || ""}`;
}

module.exports = { upload, randomFilename, MAX_FILE_BYTES, MAX_FILES, EXT_BY_MIME };
