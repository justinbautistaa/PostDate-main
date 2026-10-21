# PostDate

React/Vite frontend with an Express/Mongoose API. The existing hosted deployment is https://postdate.onrender.com. This local folder has no Git metadata; publishing local edits requires updating the linked repository and deploying the reviewed commit. See DEPLOYMENT.md.

For verified live behavior, see SECURITY_ACCEPTANCE_2026-10-20.md. Later acceptance results supersede gaps in historical reviews. Recovery procedures are in RECOVERY_RUNBOOK.md; optional independent backup activation is in PRIVATE_BACKUP_SETUP.md.

## Run locally

For everyday use on this computer, keep MongoDB running and run `npm start`
from the project folder. Open **http://localhost:5000**. This builds the website
and serves it with the API on one address, using the existing local database
and email settings in `backend/.env`. Photos are saved in `backend/uploads`
and remain there after restarts. Back up that folder along with MongoDB.
The local server accepts connections only from this computer. Keep the terminal
open while using PostDate; press Ctrl+C to stop it. This does not copy accounts
or photos from the hosted database or Cloudinary.

The coverage configuration loader uses an explicit `js-yaml` 4 override to
remove the vulnerable legacy `argparse`/`sprintf-js` dependency chain. Its YAML
loading API remains supported; keep the override until the upstream loader
updates its dependency.

Use Node 24.15 or later. Install dependencies:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
```

On Windows, `powershell -File scripts/verifyLocal.ps1 -Install` installs locked dependencies and runs both suites and the production build. It selects a compatible bundled Node when system Node is too old, without changing the system installation. Omit `-Install` for subsequent checks.

Multipart signup and profile-photo uploads share one in-flight slot per server process. A competing batch receives HTTP 503 with `Retry-After: 5` and a retry message before image buffering. JSON signup, login and normal reads do not use this slot. This reduces simultaneous-upload memory pressure; it does not establish production load capacity or remove hosting limits.

Copy `backend/.env.example` to ignored `backend/.env`, generate a random JWT signing secret, and configure MongoDB and email delivery. For Gmail use `MAIL_MODE=gmail`, `GMAIL_USER`, and `GMAIL_APP_PASSWORD`; for Resend use `MAIL_MODE=resend`, `MAIL_API_KEY`, and `MAIL_FROM`. Start the API with `npm run dev --prefix backend` and the frontend with `npm run dev --prefix frontend`. Never place secrets in frontend variables. Check Gmail/SMTP connectivity without sending a message using `node backend/scripts/check-email.js`.

Production serves the built frontend and API from the same HTTPS origin. See [DEPLOYMENT.md](DEPLOYMENT.md) for Render, Atlas, Resend and Cloudinary setup, account requirements, monitoring, backup drills and release checks.

## Implemented flows

Password recovery uses real email delivery. For Gmail, set `MAIL_MODE=gmail`, `GMAIL_USER`, and a valid `GMAIL_APP_PASSWORD` in `backend/.env`, then restart the backend. Codes expire after five minutes; the recovery page allows requesting a replacement after 60 seconds and returning to login to change the email. Gmail authentication errors appear as `[recovery] delivery failed EAUTH` in the backend logs; replace the app password rather than using a normal Google account password. API responses remain generic so recovery does not expose whether an email has an account.

### Account workspaces

- `/dashboard` — member home with profile completion, discovery shortcuts, and profile editing links. `/user` redirects here.
- `/admin` — overview, users, staff management, reports, appeals, ratings, statistics, and staff activity. Administrators can promote members, change team roles, and moderate accounts.
- `/staff` — overview, users, reports, appeals, and ratings for accounts with the existing `moderator` role. Staff can manage member accounts, but cannot manage administrators or other staff. `/moderator` remains available.
- `/messages` — private text conversations between active mutual matches, with saved history and automatic refresh. The member menu provides Home, Find dates, Chats, and Profile. A Chat link also appears in match history.

Login opens the workspace for the account's role. All workspaces require a session; admin and staff pages also enforce their respective roles. Counters and profiles come from the API, and existing server permissions continue to control moderation actions.

- Signup, real email verification, cookie-based login/logout and email password recovery.
- Authenticated profile details, tags, preferences and validated photo upload/delete/avatar selection.
- Filtered member discovery, persistent likes/passes, mutual matches and participant-only match history.
- Database-backed admin/moderator permissions, moderation and safety reporting.
- Shared production rate counters, security headers, strict CORS/CSRF validation and generic errors.
- Encrypted small-project database snapshots and safe restoration into an empty test database.

Photo requests require an authenticated account and current profile visibility/match permissions. New Cloudinary uploads use authenticated delivery and the backend proxies bytes rather than exposing a provider download URL. Legacy public cloud assets must be migrated and invalidated before old links can be considered protected. Distance filtering is unavailable because location coordinates are not collected. Real provider accounts and the live hosting topology still require external verification.

### Account deletion and photo privacy

Members can delete their account under **Profile → Settings → Delete my account**. The endpoint verifies the current password, the exact DELETE confirmation, and a fresh authenticator/recovery code if MFA is enabled. It revokes access immediately and enqueues durable cleanup. The server processes one queued account every 30 seconds, with retries for provider failures and restart recovery. This removes the account/profile, photos, private date plans, swipes, ratings and sent messages, and ends matches. Moderation/audit records, reports/appeals, other people's messages and historical backups may remain for their stated purposes. Staff account removal is handled by administration. Queue failures must be monitored via the fixed `[privacy]` log labels and the DeletionJob collection.

For existing Cloudinary assets, first run `node backend/scripts/migratePhotoPrivacy.js` to count referenced photos without changes. Run the same command with `--apply` to convert legacy public assets to authenticated delivery and request CDN invalidation. Already private or missing assets are reported for review. Verify real delivery and old-link invalidation on the provider; this migration has not been executed against a live account here. New uploads and local disk photos use the protected application route.

## Verification

### Role workspace features

- Admin: open **Community notices** to publish announcements for everyone, members, or staff. Only admins can publish/delete notices; the API filters each audience before returning results.
- Staff and admin: open **Member follow-ups** to search for a member, save a shared internal note, and complete/reopen follow-ups. Notes include the member and author and are inaccessible to ordinary members.
- Members: the home dashboard includes **Your date planner** and **Community notices**, with jump links near the shortcuts. Plans support dates in local time, place/details, editing/rescheduling, completion/reopening, and deletion. They remain private to their owner, including from staff/admin accounts, and do not send invitations or reminders.
- All entries persist in MongoDB. Lists show the latest 50 notices or 100 recently added follow-ups/plans and include manual refresh and error recovery. No additional environment variables are required.
- Targeted feature checks: `npm test --prefix backend -- workspace.test.js chat.test.js` and `npm test --prefix frontend -- src/tests/workspaceFeatures.test.jsx src/tests/workspaces.test.jsx src/tests/messages.test.jsx`.

```powershell
npm test --prefix backend
npm run build --prefix frontend
npm audit
npm audit --prefix backend
npm audit --prefix frontend
```

Run `npm test --prefix backend` and `npm test --prefix frontend` for the current results. The suites cover disposable-MongoDB authentication across roles and accounts, recovery, matching, review ownership/privacy, reports and appeals, chats, profile/photos, administration, date plans, and backup restoration. Provider calls in automated tests are mocked. Run `npm run build --prefix frontend` before release. See [SECURITY.md](SECURITY.md) for controls and hosting limitations.

### Live updates and boundaries

- Message alerts and unread counts appear in member navigation and admin/staff workspaces while the website is open. Open a notification to enter the conversation. Visible messages are acknowledged as read; background tabs do not clear unread messages.
- **My reports** in the member menu lists only the signed-in account's submitted reports, with pending, reviewed, resolved or dismissed status. Statuses refresh automatically while the page is visible; alerts and a menu badge show unseen decisions elsewhere. Opening report decisions marks those versions seen. Manual refresh and older pages are also available. Private staff notes remain hidden.
- Messages and community notices use authenticated server-sent events with automatic reconnection. Signals never include message text or private notices; an authenticated API request rechecks the audience and account status. Cross-instance updates reconcile within 15 seconds. Notifications are in-app, not closed-browser push or email.
- Live read endpoints have a separate per-account limit of 600 requests per 15 minutes; mutation and login limits remain in place. Normal chat polling is a fallback, with live refreshes only when unread state changes.
- In **Chats → View profile**, choose **Block person** or **Unmatch**, then confirm. This ends the match for both people, removes it from active chats/history, prevents further messages and rematching, and hides the pair from discovery. **Profile → Settings → Blocked people** lets the blocker remove their block. It does not reactivate the old match, reopen chats, or override another person's block. Legacy blocks with no recorded blocker remain closed and need moderator review.

### Browser push notifications

Optional Web Push is implemented for messages and report decisions. After restarting the backend, open **Profile → Settings → Browser notifications → Enable browser notifications** and accept the browser prompt. A supported browser and a secure origin (HTTPS, or localhost for development) are needed. Mobile/browser restrictions can require installing the site as a home-screen app. Delivery is best effort, and a device/browser that disables background push cannot receive it.

Generate stable keys once with `node backend/scripts/setupPush.js https://YOUR-LIVE-WEBSITE` (or a `mailto:` contact). It saves `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` to ignored `backend/.env`; add the same three settings privately to your host. Existing keys are never overwritten. Local keys were prepared October 16, 2026. Never publish the private key. Only generic update text is sent to the push provider, never chat bodies, report descriptions, or private staff notes. Logout revokes push delivery for that account's sessions.

### Match reviews

Members can choose **Report this profile** in Find dates, or **Report** under a received chat message. Reports are saved to the admin/staff **Reports** queue with the selected reason and details. Suspended users can choose **Account suspended? Submit an appeal** on login or open `/appeal`; that public form verifies their account password without requiring a login session and saves to the **Appeals** queue. Staff approval reinstates the account, while denial retains its suspension. Forms confirm submission only after a successful server response and retain drafts on failure.

Open the clock icon (**Match history**), choose **Review**, select all five scores, and submit optional written feedback. A member can review only an active match they belong to, once per partner. Public reviews appear under the recipient's **Profile → Your reviews**; private reviews are available to moderation. Hidden reviews do not appear on profiles. Match history displays **Reviewed** after submission. Reviews cannot be edited after submission.

Gmail SMTP authentication and a delivery-test message to the configured sender were checked on October 16, 2026. Gmail accepted the message; inbox/spam placement still needs recipient confirmation. Never commit the sender credentials or share the Gmail App Password in chat.
