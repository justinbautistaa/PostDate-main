const nodemailer = require("nodemailer");
function mailConfig() {
  if (process.env.MAIL_MODE === "gmail") {
    const user = process.env.GMAIL_USER?.trim();
    const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
    if (!user || !pass) throw new Error("Set GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env");
    return {
      from: { name: "PostDate", address: user },
      transport: { host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass },
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 },
    };
  }
  if (process.env.MAIL_MODE !== "smtp" || !process.env.SMTP_HOST || !process.env.MAIL_FROM)
    throw new Error("Configure Gmail or SMTP settings before sending email");
  return {
    from: process.env.MAIL_FROM,
    transport: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      requireTLS: process.env.SMTP_SECURE !== "true",
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    },
  };
}
async function sendCode(email, code, purpose) {
  // Codes are secrets: never write them or recipients to application logs.
  const config = mailConfig();
  const transport = nodemailer.createTransport(config.transport);
  await transport.sendMail({
    from: config.from, to: email,
    subject: `PostDate ${purpose} code`,
    text: `Your PostDate ${purpose} code is ${code}. It expires in 5 minutes.`,
  });
}
async function verifyConnection() {
  const transport = nodemailer.createTransport(mailConfig().transport);
  try { await transport.verify(); }
  finally { transport.close(); }
}
module.exports = { sendCode, verifyConnection };
