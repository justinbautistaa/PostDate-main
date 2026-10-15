// Only messages authored here may reach hosting logs. Driver errors and
// URL parser errors can contain credentials, so never forward their text.
const SAFE_MESSAGES = new Set([
  "JWT_SECRET must contain at least 32 bytes of random secret material",
  "MONGO_URI is required",
  "Production CLIENT_URL must be an HTTPS origin",
  "Configure a stable MFA_ENCRYPTION_KEY before production startup",
  "CLIENT_URL must be an exact origin without a trailing slash",
  "Configure a Gmail, SMTP, or Resend sender before production startup",
  "Cloud photo storage is not configured",
  "Set STORAGE_PROVIDER to cloudinary, or local only with a persistent disk",
  "Production debugging is disabled",
  "Database connection failed",
]);
async function startupStep(stage, operation) {
  try { return await operation(); }
  catch (error) {
    const detail = SAFE_MESSAGES.has(error.message) ? error.message : "Check this stage's settings and access; sensitive error details are omitted";
    const failure = new Error(`Startup failed [${stage}]: ${detail}`);
    failure.safeStartupMessage = failure.message;
    throw failure;
  }
}
module.exports = { startupStep };
