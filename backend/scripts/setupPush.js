const fs = require("fs");
const path = require("path");
const webpush = require("web-push");
const subject = process.argv[2];
if (!subject || !/^(https:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/.test(subject)) {
  console.error("Provide your HTTPS website URL or mailto contact as the argument. No keys were changed."); process.exitCode = 1;
} else {
  const filename = path.join(__dirname, "../.env");
  const current = fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : "";
  if (/^VAPID_(?:PUBLIC|PRIVATE)_KEY=\S+/m.test(current)) { console.error("Push keys already exist. Keep them stable; no changes made."); process.exitCode = 1; }
  else {
    const keys = webpush.generateVAPIDKeys();
    const cleaned = current.replace(/^VAPID_(?:PUBLIC_KEY|PRIVATE_KEY|SUBJECT)=.*\r?\n?/gm, "");
    fs.writeFileSync(filename, `${cleaned.trimEnd()}\nVAPID_SUBJECT=${subject}\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`, { mode: 0o600 });
    console.log("Push keys saved to ignored backend/.env. Add these three settings to your host securely; do not share the private key.");
  }
}
