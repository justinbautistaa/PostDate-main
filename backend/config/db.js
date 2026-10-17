const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const recovery = await require("../utils/staffMfaRecovery").recoverStaffMfa();
    if (recovery !== "disabled") console.log(`[mfa-recovery] ${recovery}; fresh staff enrollment remains required`);
    console.log("Database connected");
  } catch (error) {
    throw new Error("Database connection failed");
  }
};

module.exports = connectDB;
