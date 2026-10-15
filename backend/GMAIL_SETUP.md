# Gmail verification email

1. Enable 2-Step Verification on the Google account that will send mail.
2. Open https://myaccount.google.com/apppasswords and create an App Password named PostDate.
3. Edit `backend/.env` locally:

```dotenv
MAIL_MODE=gmail
GMAIL_USER=your-address@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
```

Use the App Password, not your normal Google password. Spaces in the displayed App Password are removed automatically. Keep this file private; never put credentials in frontend code or chat. Gmail mode uses the authenticated account as the sender, so `MAIL_FROM` and `SMTP_*` are not needed in this mode.

From the project root, check authentication without sending any message:

```powershell
node backend/scripts/check-email.js
```

Restart the app with `npm.cmd run dev`, then complete signup. The existing `POST /api/verify/send` endpoint emails the code, and `POST /api/verify/confirm` checks it. Recovery codes use Gmail too. Codes expire after five minutes. Check the inbox and spam folder.

App Passwords require 2-Step Verification and may be unavailable for some organizational accounts, Advanced Protection accounts, or accounts configured for security-key-only verification. See Google's instructions: https://support.google.com/accounts/answer/185833

Gmail SMTP settings: https://support.google.com/mail/answer/7104828

Verification requires working Gmail or SMTP credentials. Console code logging has been disabled to avoid exposing verification secrets. Automated tests mock Gmail; they do not confirm delivery to a real inbox.
