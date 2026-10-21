# Put PostDate online

The existing site is https://postdate.onrender.com, deployed from `justinbautistaa/PostDate-main` on branch `main`. Use DEPLOYMENT.md for that service. The steps below describe a new installation; do not create a duplicate service when updating the current site.

## 1. Put the source on GitHub

Create a private GitHub repository and push this project using GitHub Desktop or Git. This checkout currently has no remote. Keep `.gitignore` intact: never upload `backend/.env`, uploaded photos, backups, or `node_modules`. Check the files before publishing. The source includes `render.yaml` at the repository root.

## 2. Prepare the external services

- MongoDB Atlas: create a database and an application database user. Copy its connection URI into Render as `MONGO_URI`, with the database name included. Restrict database access to your host and use the application credential, not an administrator account.
- Cloudinary: get your cloud name, API key, and API secret. Add the three `CLOUDINARY_...` settings listed in the template privately on Render. Existing local profile photos need migration; switching storage does not copy them automatically.
- Email: the current template uses Gmail API HTTPS delivery (`MAIL_MODE=gmail-api`). Configure `GMAIL_USER`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REFRESH_TOKEN` privately; see backend/GMAIL_API_SETUP.md. Optional Resend delivery requires its own sender configuration.

## 3. Create the Render service

In Render, choose New → Blueprint, connect your GitHub account, and select the repository containing `render.yaml`. Review the service and environment settings. The template generates `JWT_SECRET`; do not replace it with a sample secret. Add the database, email, and Cloudinary values in the host's environment settings, never in frontend code.

Build: `npm ci --prefix backend --omit=dev && npm ci --prefix frontend --include=dev && npm run build --prefix frontend`

Start: `npm start --prefix backend`

Health check: `/healthz`

The template uses a free preview instance, which can sleep. Review the selected plan and its limitations before confirming deployment. No paid plan has been selected by this work.

## 4. Configure the live URL and push

Render supplies the HTTPS `onrender.com` URL and the app uses it as the allowed client origin. For a custom domain, set `CLIENT_URL` to the exact HTTPS origin without a trailing slash. The frontend and API must use that same origin.

For browser push, copy `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` from your ignored local backend environment into Render's private environment settings. Keep keys stable and never share the private key. Users enable notifications themselves under Profile → Settings. Browser/device support and permission are required.

## 5. Run the live acceptance checks

With two ordinary user accounts in separate browsers, verify real signup email, verification, login, recovery, photo upload, matching, chat, notification delivery, reviews, reports, and block/unblock. Test with the site tab closed for browser push. Verify admin/staff permissions separately, and check that report decisions appear to their reporter only.

Check `/healthz`, HTTPS cookies, actual proxy/rate-limit behavior, persistent photos, provider errors and logs. Schedule encrypted database backups to a separate location and perform a restoration drill into an empty test database. Test keys and mocked automated tests do not verify production accounts or backup recovery.

See DEPLOYMENT.md for detailed configuration and backup commands. Hosting credentials should be entered directly in the host dashboard, not pasted into chat.

The October 20 acceptance record confirms bounded live tests and an off-host production archive/restore. See SECURITY_ACCEPTANCE_2026-10-20.md. RECOVERY_RUNBOOK.md covers recovery decisions; PRIVATE_BACKUP_SETUP.md describes the prepared independent runner and its activation requirements.
