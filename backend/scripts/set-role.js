const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const connectDB = require("../config/db");
async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !["user", "moderator", "admin"].includes(role)) throw new Error("Usage: node scripts/set-role.js email@example.com user|moderator|admin");
  await connectDB();
  const user = await User.findOneAndUpdate({ email: email.trim().toLowerCase(), isActive: true, isVerified: true }, { role }, { new: true });
  if (!user) throw new Error("No active, verified account with that email");
  console.log("Role updated to " + role);
}
main().catch(error => { console.error("Role update failed. Check the email, role, verification status, and database connection."); process.exitCode = 1; }).finally(() => mongoose.disconnect());
