const { emailCode, emailConfigured } = require("../utils/verification");
const savedEnv = process.env, savedFetch = global.fetch;
beforeEach(() => {
  process.env = { ...savedEnv, MAIL_MODE: "gmail-api", GMAIL_USER: "sender@gmail.com", GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret", GOOGLE_REFRESH_TOKEN: "refresh" };
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "access" }) }).mockResolvedValueOnce({ ok: true });
});
afterEach(() => { process.env = savedEnv; global.fetch = savedFetch; });
test.each(["verification", "recovery"])("sends %s codes via OAuth and Gmail HTTPS with matching recipient", async purpose => {
  expect(emailConfigured()).toBe(true);
  await emailCode("member@gmail.com", "012345", purpose);
  const [tokenUrl, tokenOptions] = global.fetch.mock.calls[0];
  expect(tokenUrl).toBe("https://oauth2.googleapis.com/token");
  expect(tokenOptions.body.get("grant_type")).toBe("refresh_token");
  expect(tokenOptions.body.get("refresh_token")).toBe("refresh");
  const [sendUrl, options] = global.fetch.mock.calls[1];
  expect(sendUrl).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
  expect(options.headers.Authorization).toBe("Bearer access");
  const raw = Buffer.from(JSON.parse(options.body).raw, "base64url").toString();
  expect(raw).toContain("From: PostDate <sender@gmail.com>\r\nTo: member@gmail.com\r\n");
  expect(raw).toContain("012345");
  expect(raw).toContain(purpose === "recovery" ? "password recovery" : "verification");
});
test("missing authorization fails before a network request", async () => {
  delete process.env.GOOGLE_REFRESH_TOKEN;
  expect(emailConfigured()).toBe(false);
  await expect(emailCode("member@gmail.com", "123456")).rejects.toThrow("not configured");
  expect(global.fetch).not.toHaveBeenCalled();
});
test("rejects mail header injection", async () => {
  await expect(emailCode("member@gmail.com\r\nBcc: other@gmail.com", "123456")).rejects.toThrow("Invalid email message");
  expect(global.fetch).not.toHaveBeenCalled();
});
test("token failures do not expose Google responses or send a message", async () => {
  global.fetch.mockReset().mockResolvedValue({ ok: false });
  await expect(emailCode("member@gmail.com", "123456")).rejects.toThrow("Gmail API delivery failed");
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
test("send failures propagate so verification can discard undelivered codes", async () => {
  global.fetch.mockReset().mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "access" }) }).mockResolvedValueOnce({ ok: false });
  await expect(emailCode("member@gmail.com", "123456")).rejects.toThrow("Gmail API delivery failed");
});
