const { isValidEmail } = require("./validators");

function configured() {
  return Boolean(isValidEmail(process.env.GMAIL_USER) &&
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

async function sendCode(email, code, purpose = "verification") {
  if (!configured()) throw new Error("Gmail API is not configured");
  if (!isValidEmail(email) || /[\r\n]/.test(email) || /[\r\n]/.test(process.env.GMAIL_USER) || !/^\d{6}$/.test(code)) {
    throw new Error("Invalid email message");
  }
  // Only the server exchanges the refresh token. Never log Google responses:
  // they can contain credentials or recipient details.
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) throw new Error();
    const token = await tokenResponse.json();
    if (typeof token.access_token !== "string" || !token.access_token) throw new Error();
    const kind = purpose === "recovery" ? "password recovery" : "verification";
    const raw = Buffer.from([
      `From: PostDate <${process.env.GMAIL_USER.trim()}>`,
      `To: ${email.trim()}`,
      `Subject: Your PostDate ${kind} code`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "", `Your PostDate ${kind} code is ${code}. It expires in 5 minutes.`,
      "If you did not request this code, ignore this email.",
    ].join("\r\n")).toString("base64url");
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error();
  } catch {
    throw new Error("Gmail API delivery failed. Check sender authorization and quota.");
  }
}

module.exports = { configured, sendCode };
