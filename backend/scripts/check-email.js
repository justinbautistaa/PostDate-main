const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
const { verifyConnection } = require("../utils/mail");
verifyConnection().then(() => console.log("Email connection verified. No email was sent."))
  .catch(error => {
    // Do not print provider responses, configuration, or credentials.
    const hint = error.code === "EAUTH" ? "Check your Gmail address and App Password." :
      "Check MAIL_MODE, your email credentials, and your internet connection.";
    console.error(`Email connection failed. ${hint}`);
    process.exitCode = 1;
  });
