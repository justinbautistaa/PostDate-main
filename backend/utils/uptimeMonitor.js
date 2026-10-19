const fs = require("fs/promises");
const path = require("path");
async function monitor({ statePath, check, sendAlert, deployment, testEmail = false }) {
  let previous = {};
  try { previous = JSON.parse(await fs.readFile(statePath, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const healthy = await check();
  const changes = [];
  if (!healthy && previous.healthy !== false) changes.push("The PostDate health check is failing.");
  if (healthy && previous.healthy === false) changes.push("PostDate has recovered and is responding normally.");
  let failedDeploy = previous.failedDeploy || null;
  if (deployment && ["build_failed", "update_failed", "pre_deploy_failed"].includes(deployment.status)) {
    if (failedDeploy !== deployment.id) changes.push(`Render deployment ${deployment.id} failed (${deployment.status}).`);
    failedDeploy = deployment.id;
  } else if (deployment?.status === "live" && failedDeploy) {
    changes.push("A Render deployment is now live after the previous failure.");
    failedDeploy = null;
  }
  if (testEmail || changes.length) {
    await sendAlert(testEmail ? "PostDate monitoring test" : "PostDate status changed",
      testEmail ? "PostDate email monitoring is configured. This is a delivery test, not an outage alert." :
        `${changes.join("\n")}\n\nSite: https://postdate.onrender.com\nCheck time: ${new Date().toISOString()}\nNo account or message data is included.`);
  }
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  const temporary = `${statePath}.tmp`;
  await fs.writeFile(temporary, JSON.stringify({ healthy, failedDeploy, checkedAt: new Date().toISOString() }), { mode: 0o600 });
  await fs.rename(temporary, statePath);
  return { healthy, emailSent: testEmail || changes.length > 0 };
}
module.exports = { monitor };
