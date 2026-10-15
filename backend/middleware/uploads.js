const multer = require("multer");
const sharp = require("sharp");
const Photo = require("../models/Photo");
const mongoose = require("mongoose");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 6, fields: 20, fieldSize: 16000, parts: 26, fieldNameSize: 100 } });
async function preparePhotos(files = []) {
  const images = [];
  for (const file of files) {
    try {
      const decoder = sharp(file.buffer, { limitInputPixels: 25000000 });
      const meta = await decoder.metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format)) throw new Error("format");
      images.push(await decoder.rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer());
    } catch { throw Object.assign(new Error("Use a valid JPEG, PNG, or WebP photo (up to 5 MB)."), { status: 400 }); }
  }
  return images;
}
async function savePhotos(userId, images) {
  if (!images.length) return [];
  const pending = images.map(data => ({ _id: new mongoose.Types.ObjectId(), userId, data }));
  let records;
  try { records = await Photo.insertMany(pending); }
  catch (error) {
    await Photo.deleteMany({ _id: { $in: pending.map(photo => photo._id) }, userId });
    throw error;
  }
  return records.map(photo => `/api/photos/${photo._id}`);
}
module.exports = { upload, preparePhotos, savePhotos };
