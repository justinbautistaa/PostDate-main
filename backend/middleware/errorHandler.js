const multer = require("multer");

/**
 * asyncHandler
 * Wraps an async route handler so a rejected promise is forwarded to
 * Express's error-handling middleware instead of crashing the process or
 * hanging the request forever.
 *
 *   router.get("/x", asyncHandler(async (req, res) => { ... }));
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 for any route that didn't match anything above it. Must be registered
 * AFTER every real route (see server.js) — otherwise nothing ever reaches
 * it. Keeps unknown routes from falling through to the generic 500 handler
 * with a misleading status code.
 */
function notFound(req, res, next) {
  res.status(404).json({ message: "Not found" });
}

// Multer's own error codes -> a message safe to show the person who hit it.
// See middleware/upload.js for the limits these refer to.
const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: "Each photo must be under 5MB",
  LIMIT_FILE_COUNT: "Too many photos in one upload",
  LIMIT_UNEXPECTED_FILE: "Too many photos in one upload",
};

/**
 * Central error handler. Must be the LAST app.use() in server.js.
 *
 * Logs only a fixed event label and sends a generic
 * message to the client for anything that isn't a known, safe-to-describe
 * error shape — never a stack trace, a file path, or a raw driver message.
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const photoErrors = {
    PHOTO_STORAGE_AUTH: "Photo storage credentials were rejected. The site owner needs to check the Cloudinary cloud name, API key and matching API secret.",
    PHOTO_STORAGE_PERMISSION: "Photo storage denied this upload. The site owner needs to check Cloudinary key permissions and account restrictions.",
    PHOTO_STORAGE_QUOTA: "Photo storage has reached a usage limit. Please try again later.",
    PHOTO_STORAGE_UNAVAILABLE: "Photo storage could not be reached. Please try uploading one photo again.",
    PHOTO_STORAGE_REJECTED: "Photo storage rejected the request. The site owner needs to check the Cloudinary configuration.",
  };
  if (Object.hasOwn(photoErrors, err.code || "")) {
    console.error(`[photo-storage] ${err.code}`);
    return res.status(503).json({ message: photoErrors[err.code] });
  }
  if (err.code === 50) return res.status(503).json({ message: "The request took too long. Please try again." });
  // Never log bodies, query strings, driver errors or exception messages.
  console.error("[request] failed");

  // Mongoose validation errors -> 400. Field names are safe to return;
  // Mongoose's own message text sometimes isn't, so we don't forward it.
  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: "Invalid input",
      fields: Object.keys(err.errors || {}),
    });
  }

  // Duplicate key (unique index) -> 409
  if (err.code === 11000) {
    return res.status(409).json({ message: "That value is already in use" });
  }

  // Malformed ObjectId, etc.
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid request" });
  }

  // A photo upload broke a limit from middleware/upload.js (file too big,
  // too many files) — 400, not the generic 500.
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: MULTER_MESSAGES[err.code] || "Could not upload that file" });
  }

  // Thrown by upload.js's fileFilter for a disallowed mimetype.
  if (err.message === "UNSUPPORTED_FILE_TYPE") {
    return res.status(400).json({ message: "Only JPG, PNG, WEBP or GIF images are allowed" });
  }

  const status = [400, 401, 403, 404, 409, 413, 429].includes(err.status || err.statusCode) ? (err.status || err.statusCode) : 500;
  const message = status < 500 ? "Invalid request" : "Something went wrong";
  res.status(status).json({ message });
}

module.exports = { asyncHandler, notFound, errorHandler };
