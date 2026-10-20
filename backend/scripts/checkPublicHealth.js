const { checkPublicHealth } = require("../utils/publicHealthCheck");
checkPublicHealth().then(healthy => {
  console.log(healthy ? "PostDate health check passed." : "PostDate health check failed after bounded retries.");
  if (!healthy) process.exitCode = 1;
}).catch(() => {
  console.error("PostDate health check could not execute.");
  process.exitCode = 1;
});
