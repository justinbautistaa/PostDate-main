const { validateConfig } = require("../config/security");
const { allowedOrigins } = require("../middleware/requestSecurity");
const base = { JWT_SECRET: "a".repeat(48), MONGO_URI: "mongodb://user:password@localhost/postdate", NODE_ENV: "production", CLIENT_URL: "https://postdate.example", MAIL_MODE: "gmail", GMAIL_USER: "sender@gmail.com", GMAIL_APP_PASSWORD: "test-password" };
test("production refuses weak secrets, unauthenticated databases, console mail and debugging", () => {
  expect(() => validateConfig(base)).not.toThrow();
  for (const change of [{ JWT_SECRET: "short" }, { MONGO_URI: "mongodb://localhost/postdate" }, { MAIL_MODE: "console" }, { CLIENT_URL: "" }, { DEBUG: "*" }, { NODE_OPTIONS: "--inspect" }]) {
    expect(() => validateConfig({ ...base, ...change })).toThrow();
  }
});
test("production CORS rejects HTTP, wildcard, and path-based origins", () => {
  const original = process.env;
  try {
    process.env = { ...original, NODE_ENV: "production", CLIENT_URL: "https://postdate.example" };
    expect(allowedOrigins()).toEqual(["https://postdate.example"]);
    for (const origin of ["*", "http://postdate.example", "https://postdate.example/path", "https://postdate.example/"]) {
      process.env.CLIENT_URL = origin; expect(() => allowedOrigins()).toThrow();
    }
  } finally { process.env = original; }
});
