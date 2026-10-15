import { beforeEach, expect, it, vi } from "vitest";

beforeEach(() => { vi.resetModules(); localStorage.clear(); });
it("removes old local tokens, uses cookies, and adds the write-protection header", async () => {
  localStorage.setItem("token", "old-sensitive-token");
  const { default: api } = await import("../api");
  await import("../auth");
  expect(localStorage.getItem("token")).toBeNull();
  const captured = [];
  api.defaults.adapter = async config => { captured.push(config); return { data: {}, status: 200, statusText: "OK", headers: {}, config }; };
  await api.post("/auth/login", { email: "alice@example.com", password: "password" });
  await api.get("/auth/me");
  expect(captured[0].withCredentials).toBe(true);
  expect(captured[0].headers["X-Postdate-Request"]).toBe("1");
  expect(captured[0].headers.Authorization).toBeUndefined();
  expect(captured[1].headers["X-Postdate-Request"]).toBe("1");
});
it("logout waits for server revocation and reports failures", async () => {
  const { default: api } = await import("../api");
  await import("../auth");
  const { logout } = await import("../auth");
  const revoked = vi.fn(); window.addEventListener("postdate:session-expired", revoked);
  try {
    api.defaults.adapter = async () => { throw new Error("offline"); };
    await expect(logout()).rejects.toThrow("offline");
    expect(revoked).not.toHaveBeenCalled();
    api.defaults.adapter = async config => ({ data: { ok: true }, status: 200, statusText: "OK", headers: {}, config });
    await logout();
  } finally { window.removeEventListener("postdate:session-expired", revoked); }
});
