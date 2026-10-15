const fs = require("fs");
// Prefer the installed MongoDB binary to a network download on this workstation.
const localMongo = "C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe";
if (!process.env.MONGOMS_SYSTEM_BINARY && fs.existsSync(localMongo)) {
  process.env.MONGOMS_SYSTEM_BINARY = localMongo;
  process.env.MONGOMS_SYSTEM_BINARY_VERSION_CHECK = "false";
}
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || "7.0.14";
module.exports = { testEnvironment: "node", testTimeout: 60000 };
