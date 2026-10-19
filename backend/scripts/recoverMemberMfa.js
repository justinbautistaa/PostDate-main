require("dotenv").config({ path: require("path").join(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
(async () => {
  if (process.env.MEMBER_MFA_OWNERSHIP_VERIFIED !== "true") throw new Error("Ownership not verified");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const result = await require("../utils/memberMfaRecovery").recoverMemberMfa({
    email: process.env.MEMBER_MFA_RECOVERY_EMAIL,
    requestId: process.env.MEMBER_MFA_RECOVERY_REQUEST_ID,
    caseReference: process.env.MEMBER_MFA_RECOVERY_CASE,
    ownershipVerified: true,
  });
  console.log(`Member MFA recovery: ${result}. Existing sessions revoked; ask the owner to enroll a new authenticator.`);
})().catch(() => {
  console.error("Recovery refused or failed. Check independent ownership verification, case reference, request ID and account eligibility. No credentials were logged.");
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
