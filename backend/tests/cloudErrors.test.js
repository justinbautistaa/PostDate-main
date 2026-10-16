const cloud = require("../utils/cloudPhotos");
const { errorHandler } = require("../middleware/errorHandler");
const originalEnv = process.env, originalFetch = global.fetch;
beforeEach(() => {
  process.env = { ...originalEnv, CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret" };
});
afterEach(() => { process.env = originalEnv; global.fetch = originalFetch; jest.restoreAllMocks(); });
test.each([[401,"PHOTO_STORAGE_AUTH"],[403,"PHOTO_STORAGE_PERMISSION"],[429,"PHOTO_STORAGE_QUOTA"],[400,"PHOTO_STORAGE_REJECTED"]])("classifies Cloudinary %s without exposing its response", async (status, code) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status });
  await expect(cloud.uploadCloudPhoto("a".repeat(32)+".webp", Buffer.from("image"))).rejects.toMatchObject({ code });
});
test("classifies network failures without exposing credentials", async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("private credential"));
  await expect(cloud.uploadCloudPhoto("a".repeat(32)+".webp", Buffer.from("image"))).rejects.toMatchObject({ code: "PHOTO_STORAGE_UNAVAILABLE", message: "Cloud photo operation failed" });
});
test("returns a safe actionable storage error and logs only its classification", () => {
  const log = jest.spyOn(console, "error").mockImplementation(()=>{});
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  errorHandler({ code: "PHOTO_STORAGE_AUTH", message: "private credential" }, {}, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith({message: expect.stringContaining("credentials were rejected")});
  expect(log).toHaveBeenCalledWith("[photo-storage] PHOTO_STORAGE_AUTH");
});
