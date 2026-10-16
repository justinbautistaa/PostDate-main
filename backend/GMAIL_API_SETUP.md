# Gmail API delivery

This sends signup verification and password recovery codes over HTTPS, including
on Render Free. It does not change Atlas accounts or MFA. Only the site owner's
sender mailbox authorizes Google access; members just receive email normally.

## Configure Google

1. Open https://console.cloud.google.com/ and create/select a PostDate project.
2. Enable Gmail API under APIs & Services → Library.
3. Configure Google Auth Platform branding, audience, and contact email. For an
   external app in Testing, add your sender Gmail account as a test user.
4. Add only `https://www.googleapis.com/auth/gmail.send` under Data Access.
5. Create an OAuth client of type Web application. For this one-time setup,
   register `https://developers.google.com/oauthplayground` as a redirect URI.
6. Open https://developers.google.com/oauthplayground/. In its settings, enable
   Use your own OAuth credentials and enter that client's ID and secret.
7. Authorize `https://www.googleapis.com/auth/gmail.send`, signing into the Gmail
   mailbox you want PostDate to send from. Request offline access, then exchange
   the authorization code for tokens. Keep the refresh token private.

## Configure Render

Set these server environment variables (never frontend variables or GitHub):

```text
MAIL_MODE=gmail-api
GMAIL_USER=your-sender@gmail.com
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
```

Remove obsolete MAIL_API_KEY and MAIL_FROM settings once Gmail API is enabled.
Deploy the updated code before selecting this mail mode. Never replace JWT_SECRET
or MFA_ENCRYPTION_KEY as part of email setup.

Testing-mode refresh tokens for Gmail scopes expire after seven days. Complete
Google's publishing/verification requirements as applicable before relying on
this for ongoing public signups. Authorization may also be revoked; if sending
fails, reauthorize the sender and replace the refresh token. Gmail sending limits
apply; this is a small-project sender, not a bulk-email service.

## Verify

Register a new member with a mailbox you control. Check inbox/spam, enter the
received six-digit code, and confirm login is blocked before confirmation and
allowed afterward. Also test password recovery. Automated tests mock Google and
do not prove live delivery. Do not share tokens or verification codes in logs.

References:
- https://developers.google.com/workspace/gmail/api/guides/sending
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/protocols/oauth2#expiration
