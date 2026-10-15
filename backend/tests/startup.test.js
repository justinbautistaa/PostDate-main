const { startupStep } = require("../utils/startup");
test("startup names missing configuration without forwarding arbitrary errors", async () => {
  await expect(startupStep("environment configuration", () => { throw new Error("MONGO_URI is required"); })).rejects.toThrow("Startup failed [environment configuration]: MONGO_URI is required");
  const secret = "mongodb://user:private-password@example.com";
  try { await startupStep("MongoDB connection", () => { throw new Error(secret); }); }
  catch (error) { expect(error.safeStartupMessage).toContain("MongoDB connection"); expect(error.safeStartupMessage).not.toContain(secret); }
});
