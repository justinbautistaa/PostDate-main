const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const target = path.join(__dirname, "..", ".env");
if (fs.existsSync(target)) console.log("backend/.env already exists; left unchanged.");
else {
  const example = fs.readFileSync(path.join(__dirname, "..", ".env.example"), "utf8");
  fs.writeFileSync(target, example.replace("replace-with-a-random-secret-of-at-least-32-characters", crypto.randomBytes(48).toString("hex")));
  console.log("Created backend/.env with a random local JWT secret.");
}
