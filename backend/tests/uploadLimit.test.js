const express = require("express"), request = require("supertest");
const { upload, MAX_FILE_BYTES } = require("../middleware/upload");
const { errorHandler } = require("../middleware/errorHandler");
const app = express();
app.post("/", upload.array("photos", 10), (req,res) => res.json({ sizes: req.files.map(file => file.size) }));
app.use(errorHandler);
jest.setTimeout(60000);
test("accepts a photo exactly at the 50 MiB boundary", async () => {
  const r = await request(app).post("/").attach("photos", Buffer.alloc(MAX_FILE_BYTES), { filename:"photo.jpg", contentType:"image/jpeg" });
  expect(r.status).toBe(200); expect(r.body.sizes).toEqual([MAX_FILE_BYTES]);
});
test("rejects a batch above 50 MiB", async () => {
  const log = jest.spyOn(console,"error").mockImplementation(()=>{});
  try {
    const r = await request(app).post("/").attach("photos",Buffer.alloc(30*1024*1024),{filename:"a.jpg",contentType:"image/jpeg"}).attach("photos",Buffer.alloc(21*1024*1024),{filename:"b.jpg",contentType:"image/jpeg"});
    expect(r.status).toBe(400); expect(r.body.message).toContain("50 MB");
  } finally { log.mockRestore(); }
});
