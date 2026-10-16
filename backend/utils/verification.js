const crypto = require("crypto");

function emailConfigured() {
  if (process.env.MAIL_MODE === "gmail-api") return require("./gmailApi").configured();
  if (process.env.MAIL_MODE === "gmail") return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  if (process.env.MAIL_MODE === "smtp") return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);
  return Boolean(process.env.MAIL_API_KEY && process.env.MAIL_FROM);
}

function codeHash(email, code) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update(`${email}:${code}`).digest("hex");
}

async function emailCode(email, code, purpose = "verification") {
  if (process.env.MAIL_MODE === "gmail-api") return require("./gmailApi").sendCode(email, code, purpose);
  if (["gmail", "smtp"].includes(process.env.MAIL_MODE)) {
    return require("./mail").sendCode(email, code, purpose);
  }
  if (!process.env.MAIL_API_KEY || !process.env.MAIL_FROM) {
    throw new Error("Email delivery is not configured");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MAIL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [email],
      subject: purpose === "recovery" ? "Reset your PostDate password" : "Verify your PostDate email",
      text: `Your PostDate ${purpose === "recovery" ? "password recovery" : "verification"} code is ${code}. It expires in 5 minutes. If you did not request it, ignore this email.`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Email delivery failed");
}

module.exports = { codeHash, emailCode, emailConfigured };
