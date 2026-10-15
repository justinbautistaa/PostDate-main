const fs = require("fs"), path = require("path"), crypto = require("crypto");
const filename = path.join(__dirname, "../.env");
const existing = fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : "";
if (/^MFA_ENCRYPTION_KEY=\S+/m.test(existing)) console.log("Existing MFA encryption key preserved.");
else { fs.writeFileSync(filename, existing.replace(/^MFA_ENCRYPTION_KEY=.*\r?\n?/gm, "").trimEnd() + "\nMFA_ENCRYPTION_KEY=" + crypto.randomBytes(32).toString("hex") + "\n", { mode:0o600 }); console.log("MFA encryption key saved to ignored backend/.env. Store a secure backup separately; no key was displayed."); }
