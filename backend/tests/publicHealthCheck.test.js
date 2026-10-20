const { checkPublicHealth } = require("../utils/publicHealthCheck");
test("requires both a successful HTTP status and readiness", async () => {
  for (const response of [{ ok: false, json: async () => ({ status: "ready" }) }, { ok: true, json: async () => ({ status: "starting" }) }]) {
    const fetchImpl = jest.fn().mockResolvedValue(response);
    expect(await checkPublicHealth({ fetchImpl })).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  }
});
test("recovers from transient transport and invalid JSON failures", async () => {
  const fetchImpl = jest.fn().mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ ok: true, json: async () => { throw new Error("not JSON"); } })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "ready" }) });
  expect(await checkPublicHealth({ fetchImpl })).toBe(true);
  expect(fetchImpl).toHaveBeenCalledTimes(3);
  expect(fetchImpl.mock.calls[0][1].redirect).toBe("error");
});
