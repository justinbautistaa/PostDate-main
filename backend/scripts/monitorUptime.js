const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.monitor"), quiet: true });
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const args = process.argv.slice(2);
const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
async function check() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch("https://postdate.onrender.com/healthz", { redirect: "error", signal: AbortSignal.timeout(30000) });
      if (response.ok && (await response.json()).status === "ready") return true;
    } catch { /* Retry without logging provider responses or credentials. */ }
  }
  return false;
}
(async () => {
  const email = process.env.MONITOR_EMAIL_TO;
  if (!require("../utils/validators").isValidEmail(email)) throw new Error("Missing recipient");
  const id = value("--deploy-id"), status = value("--deploy-status");
  if (id && !/^dep-[a-z0-9]+$/.test(id)) throw new Error("Invalid deploy ID");
  const result = await require("../utils/uptimeMonitor").monitor({
    statePath: path.join(__dirname, "../.cache/uptime-monitor.json"), check,
    deployment: id && status ? { id, status } : undefined,
    testEmail: args.includes("--test-email"),
    sendAlert: (subject, text) => require("../utils/mail").sendOperationalAlert(email, subject, text),
  });
  console.log(JSON.stringify(result));
})().catch(() => { console.error("Monitoring check or alert delivery failed. Check connectivity, recipient and local mail configuration; credentials were not logged."); process.exitCode = 1; });
