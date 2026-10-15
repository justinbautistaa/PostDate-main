# PostDate backend

Express and MongoDB API. See [the security review](../SECURITY_REVIEW.md) for the full control checklist, validation results and deployment boundaries.

## Local setup

From the project root:

~~~powershell
node backend/scripts/setup.js
npm.cmd install
npm.cmd install --prefix backend
npm.cmd install --prefix frontend
npm.cmd run dev
~~~

Start MongoDB and configure backend/.env first. Local UI runs on http://127.0.0.1:5173; Vite proxies /api and /uploads to the backend on port 5000. Use VITE_API_URL=/api. Do not put mail/database secrets in frontend environment files.

Required backend settings: MONGO_URI, a random JWT_SECRET of at least 32 characters (used for keyed verification digests), CLIENT_URL, and a working MAIL_MODE=gmail or MAIL_MODE=smtp provider. See [Gmail setup](GMAIL_SETUP.md). Console code logging has been removed.

## Sessions and permissions

POST /api/auth/login sets an HttpOnly cookie and returns userId and role, not a token. GET /api/auth/me checks the current account and session. POST /api/auth/logout revokes the session. Send X-PostDate-Request: 1 with every POST/PUT/DELETE request. The browser API adapter does this automatically and enables credentials. External scripts must also use the cookie returned by login; Bearer tokens are no longer accepted.

Signup and verification: POST /api/signup, /api/verify/send and /api/verify/confirm. Password recovery: POST /api/auth/recovery/request, /api/auth/recovery/verify and /api/auth/recovery/reset. Verification and reset are single-use and expire in five minutes.

Profile/discovery endpoints require an active, verified account. Photo reads require authentication too. Profile writes always use the session owner. Admin/staff endpoints also check current database roles. Signup cannot create privileged users.

To grant a role to an existing verified account:

~~~powershell
node backend/scripts/set-role.js person@example.com admin
node backend/scripts/set-role.js person@example.com moderator
~~~

This is a local administrator command, not a public API. Users visit /dashboard, admins /admin and staff /staff.

## Production

Build the frontend, set NODE_ENV=production, configure an exact HTTPS CLIENT_URL and authenticated MongoDB URI, and run npm.cmd start --prefix backend behind an HTTPS reverse proxy. Express serves the built frontend itself. Production sessions use Secure, HttpOnly, SameSite cookies. Read the deployment requirements in SECURITY_REVIEW.md before exposing the service.

## Checks

~~~powershell
npm.cmd run security:check
~~~

Tests use disposable MongoDB instances and mocked mail. They do not send email or alter real accounts.
