// Operator-only read diagnostic. No signed URLs or account details are logged.
async function diagnosePhoto() {
  const filename = process.env.PHOTO_DIAGNOSTIC_FILENAME;
  if (!filename) return;
  const cloud = require("./cloudPhotos");
  if (!cloud.validFilename(filename)) throw new Error("Invalid photo diagnostic target");
  const value = `/uploads/${filename}`;
  const Profile = require("../models/Profile");
  const profile = await Profile.findOne({ $or: [{ photos: value }, { avatar: value }] }).select("avatar photos").lean();
  const result = { referenced: Boolean(profile), inGallery: profile?.photos?.includes(value) || false,
    isAvatar: profile?.avatar === value, galleryCount: profile?.photos?.length || 0 };
  if (cloud.isCloudStorage()) {
    const { cloud: name, key, secret } = cloud.cloudConfig();
    const id = encodeURIComponent(`postdate/${filename.slice(0, -5)}`);
    for (const type of ["authenticated", "upload"]) {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${name}/resources/image/${type}/${id}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
        redirect: "error", signal: AbortSignal.timeout(15000),
      });
      result[type] = response.status;
      await response.body?.cancel();
    }
  }
  console.log("[photo-diagnostic]", JSON.stringify(result));
  return result;
}
module.exports = { diagnosePhoto };
