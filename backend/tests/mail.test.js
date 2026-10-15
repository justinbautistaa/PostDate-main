jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));
const nodemailer = require("nodemailer");
const { sendCode, verifyConnection } = require("../utils/mail");
const originalEnv = process.env;
let transport;
beforeEach(() => {
  process.env = { ...originalEnv, MAIL_MODE: "gmail", GMAIL_USER: "sender@gmail.com", GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop" };
  transport = { sendMail: jest.fn().mockResolvedValue({}), verify: jest.fn().mockResolvedValue(true), close: jest.fn() };
  nodemailer.createTransport.mockReturnValue(transport);
});
afterEach(() => { process.env = originalEnv; jest.clearAllMocks(); });
test("Gmail uses TLS, its authenticated sender, and an App Password without display spaces", async () => {
  await sendCode("recipient@example.com", "123456", "verification");
  expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "sender@gmail.com", pass: "abcdefghijklmnop" } }));
  expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: { name: "PostDate", address: "sender@gmail.com" }, to: "recipient@example.com", text: expect.stringContaining("123456") }));
});
test("missing Gmail credentials fail before sending", async () => {
  delete process.env.GMAIL_APP_PASSWORD;
  await expect(sendCode("recipient@example.com", "123456", "verification")).rejects.toThrow("GMAIL_APP_PASSWORD");
  expect(nodemailer.createTransport).not.toHaveBeenCalled();
});
test("connection check authenticates without sending a message", async () => {
  await verifyConnection();
  expect(transport.verify).toHaveBeenCalledTimes(1);
  expect(transport.sendMail).not.toHaveBeenCalled();
  expect(transport.close).toHaveBeenCalledTimes(1);
});
test("Gmail delivery failures propagate to challenge cleanup", async () => {
  transport.sendMail.mockRejectedValue(new Error("delivery failed"));
  await expect(sendCode("recipient@example.com", "123456", "verification")).rejects.toThrow("delivery failed");
});
test("verification dispatches through the configured Gmail adapter", async () => {
  const { emailCode } = require("../utils/verification");
  await emailCode("recipient@example.com", "123456");
  expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({
    to: "recipient@example.com", subject: "PostDate verification code",
  }));
});
test("console mode never logs verification secrets", async () => {
  process.env.MAIL_MODE = "console";
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  try {
    await expect(sendCode("recipient@example.com", "123456", "verification")).rejects.toThrow();
    expect(log).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});
