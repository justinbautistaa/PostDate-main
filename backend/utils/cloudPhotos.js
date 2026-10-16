const crypto = require("crypto");

function isCloudStorage() { return process.env.STORAGE_PROVIDER === "cloudinary"; }
function validFilename(filename) { return /^[a-f0-9]{32}\.webp$/.test(filename); }
function cloudConfig() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloud || !/^[a-z0-9_-]{1,64}$/i.test(cloud) || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloud photo storage is not configured");
  }
  return { cloud, key: process.env.CLOUDINARY_API_KEY.trim(), secret: process.env.CLOUDINARY_API_SECRET.trim() };
}
function signature(params, secret) {
  const source = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join("&");
  return crypto.createHash("sha256").update(source + secret).digest("hex");
}
async function cloudRequest(action, params, buffer) {
  const { cloud, key, secret } = cloudConfig();
  const signed = { ...params, timestamp: Math.floor(Date.now() / 1000) };
  const form = new FormData();
  for (const [name, value] of Object.entries(signed)) form.append(name, String(value));
  form.append("api_key", key);
  form.append("signature", signature(signed, secret));
  if (buffer) form.append("file", new Blob([buffer], { type: "image/webp" }), "photo.webp");
  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/${action}`, {
      method: "POST", body: form, signal: AbortSignal.timeout(15000),
    });
  } catch {
    const error = new Error("Cloud photo operation failed");
    error.code = "PHOTO_STORAGE_UNAVAILABLE";
    throw error;
  }
  if (!response.ok) {
    const error = new Error("Cloud photo operation failed");
    error.code = response.status === 401 ? "PHOTO_STORAGE_AUTH"
      : response.status === 403 ? "PHOTO_STORAGE_PERMISSION"
      : response.status === 429 ? "PHOTO_STORAGE_QUOTA" : "PHOTO_STORAGE_REJECTED";
    throw error;
  }
  return response.json();
}
function publicId(filename) {
  if (!validFilename(filename)) throw new Error("Invalid photo path");
  return `postdate/${filename.slice(0, -5)}`;
}
async function uploadCloudPhoto(filename, bytes) {
  const id = publicId(filename);
  const result = await cloudRequest("upload", { public_id: id, overwrite: false, type: "authenticated" }, bytes);
  if (result.public_id !== id || result.format !== "webp") throw new Error("Unexpected cloud photo response");
}
async function deleteCloudPhoto(filename) {
  await cloudRequest("destroy", { public_id: publicId(filename), type: "authenticated", invalidate: true });
  // Remove legacy public originals too; "not found" is an idempotent success.
  await cloudRequest("destroy", { public_id: publicId(filename), type: "upload", invalidate: true });
}
async function migrateCloudPhoto(filename) {
  const id = publicId(filename);
  return cloudRequest("rename", { from_public_id: id, to_public_id: id, type: "upload", to_type: "authenticated", invalidate: true });
}
function cloudPhotoUrl(filename) {
  const { cloud, key, secret } = cloudConfig();
  const params = { public_id: publicId(filename), format: "webp", type: "authenticated", timestamp: Math.floor(Date.now() / 1000), expires_at: Math.floor(Date.now() / 1000) + 60 };
  return `https://api.cloudinary.com/v1_1/${cloud}/image/download?${new URLSearchParams({ ...params, api_key: key, signature: signature(params, secret) })}`;
}
module.exports = { isCloudStorage, validFilename, cloudConfig, signature, uploadCloudPhoto, deleteCloudPhoto, cloudPhotoUrl, migrateCloudPhoto };
