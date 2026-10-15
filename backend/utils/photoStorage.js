const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const { isCloudStorage, uploadCloudPhoto, deleteCloudPhoto } = require("./cloudPhotos");
const { randomFilename } = require("../middleware/upload");

// backend/uploads — served statically at /uploads (see server.js). Kept out
// of git (see .gitignore) since this is local disk storage, not a real file
// service: it will NOT survive a redeploy on hosts with an ephemeral
// filesystem (Render, Heroku, ...). Fine for coursework; swap for S3/
// Cloudinary/etc. later by changing only this file and server.js's static
// mount — nothing else references the disk path directly.
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

async function ensureUploadDir() {
  if (isCloudStorage()) return;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

/**
 * Writes multer's in-memory file buffers to disk and returns their public
 * paths (what gets stored on Profile.photos / Profile.avatar), e.g.
 * ["/uploads/3f9a...c2.jpg"]. Only call this once a request is otherwise
 * fully valid — a half-written signup shouldn't leave files behind.
 */
async function savePhotosToDisk(files = []) {
  // Multipart MIME labels are untrusted. Decode then re-encode every image,
  // stripping metadata and any appended payload before it reaches storage.
  let images;
  try {
    images = [];
    for (const file of files) {
      const image = sharp(file.buffer, { limitInputPixels: 16000000, failOn: "warning", animated: false });
      const metadata = await image.metadata();
      const allowed = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
      if (allowed[file.mimetype] !== metadata.format || (metadata.pages || 1) > 1) throw new Error("Invalid image");
      images.push(await image.rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer());
    }
  } catch {
    const error = new Error("UNSUPPORTED_FILE_TYPE");
    error.status = 400;
    throw error;
  }
  await ensureUploadDir();
  const saved = [];
  try {
    for (const buffer of images) {
      const filename = randomFilename("image/webp");
      const publicPath = `/uploads/${filename}`;
      saved.push(publicPath);
      if (isCloudStorage()) await uploadCloudPhoto(filename, buffer);
      else await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer, { flag: "wx" });
    }
    return saved;
  } catch (err) {
    await Promise.all(saved.map((photo) => deletePhotoFile(photo).catch(() => {})));
    throw err;
  }
}

/**
 * Deletes one photo's file from disk, given its public path. path.basename
 * strips any directory component, so this can never be tricked into
 * deleting something outside UPLOAD_DIR even if a caller forgot to validate
 * the path first (callers should still only ever pass a path already
 * confirmed to belong to the user — see profileController.deletePhoto).
 * A file that's already gone is not an error.
 */
async function deletePhotoFile(publicPath) {
  const filename = path.basename(publicPath);
  if (isCloudStorage()) return deleteCloudPhoto(filename);
  try {
    await fs.unlink(path.join(UPLOAD_DIR, filename));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

module.exports = { UPLOAD_DIR, ensureUploadDir, savePhotosToDisk, deletePhotoFile };
