function validateConfig(env = process.env) {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || /replace-with|test-secret/i.test(env.JWT_SECRET))
    throw new Error("Configure a random JWT_SECRET with at least 32 characters");
  if (!env.MONGO_URI) throw new Error("Configure MONGO_URI");
  if (env.NODE_ENV === "production") {
    if (!env.CLIENT_URL) throw new Error("Production requires CLIENT_URL");
    if (!["gmail", "smtp"].includes(env.MAIL_MODE)) throw new Error("Production requires an email provider");
    if (env.MAIL_MODE === "gmail" && (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD)) throw new Error("Configure Gmail credentials");
    if (env.MAIL_MODE === "smtp" && (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.MAIL_FROM)) throw new Error("Configure SMTP credentials");
    const uri = new URL(env.MONGO_URI);
    if (!uri.username || !uri.password) throw new Error("Production requires an authenticated MongoDB connection");
    if (env.DEBUG || /--inspect/.test(env.NODE_OPTIONS || "") || process.execArgv.some(a => a.startsWith("--inspect")))
      throw new Error("Disable debugging in production");
  }
}
module.exports = { validateConfig };
