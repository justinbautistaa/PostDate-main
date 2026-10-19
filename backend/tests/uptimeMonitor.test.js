const fs = require("fs/promises"), os = require("os"), path = require("path");
const { monitor } = require("../utils/uptimeMonitor");
let dir, statePath, sendAlert;
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), "postdate-monitor-")); statePath = path.join(dir, "state.json"); sendAlert = jest.fn().mockResolvedValue(); });
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });
test("healthy checks stay quiet; outages and recovery send only one email per transition", async () => {
  const check = jest.fn().mockResolvedValue(true);
  await monitor({ statePath, check, sendAlert });
  expect(sendAlert).not.toHaveBeenCalled();
  check.mockResolvedValue(false);
  await monitor({ statePath, check, sendAlert });
  await monitor({ statePath, check, sendAlert });
  expect(sendAlert).toHaveBeenCalledTimes(1);
  check.mockResolvedValue(true);
  await monitor({ statePath, check, sendAlert });
  expect(sendAlert).toHaveBeenCalledTimes(2);
});
test("deployment failures are deduplicated and failed email delivery is retried", async () => {
  const options = { statePath, check: async () => true, sendAlert, deployment: { id: "dep-test", status: "build_failed" } };
  sendAlert.mockRejectedValueOnce(new Error("provider unavailable"));
  await expect(monitor(options)).rejects.toThrow();
  await monitor(options);
  await monitor(options);
  expect(sendAlert).toHaveBeenCalledTimes(2);
});
