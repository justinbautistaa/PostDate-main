jest.mock("../models/Profile", () => ({ findOne: jest.fn() }));
const Profile = require("../models/Profile");
const { diagnosePhoto } = require("../utils/photoDiagnostic");
const previous = { ...process.env }, originalFetch = global.fetch;
afterEach(() => { process.env = { ...previous }; global.fetch = originalFetch; jest.restoreAllMocks(); });
test("diagnostics are opt-in and reject arbitrary paths", async () => {
  delete process.env.PHOTO_DIAGNOSTIC_FILENAME;
  expect(await diagnosePhoto()).toBeUndefined();
  process.env.PHOTO_DIAGNOSTIC_FILENAME = "../secret";
  await expect(diagnosePhoto()).rejects.toThrow();
});
test("reports only reference flags and provider statuses without logging credentials", async () => {
  const filename = "a".repeat(32) + ".webp";
  Object.assign(process.env, { PHOTO_DIAGNOSTIC_FILENAME: filename, STORAGE_PROVIDER: "cloudinary",
    CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_API_KEY: "private-key", CLOUDINARY_API_SECRET: "private-secret" });
  Profile.findOne.mockReturnValue({ select: () => ({ lean: async () => ({ avatar: `/uploads/${filename}`, photos: [`/uploads/${filename}`] }) }) });
  global.fetch = jest.fn().mockResolvedValueOnce({ status: 404, body: { cancel: jest.fn() } })
    .mockResolvedValueOnce({ status: 200, body: { cancel: jest.fn() } });
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  expect(await diagnosePhoto()).toMatchObject({ referenced: true, inGallery: true, authenticated: 404, upload: 200 });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-key|private-secret|api.cloudinary|uploads\//);
});
