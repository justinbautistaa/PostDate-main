# PostDate deployment

Updated October 17, 2026. The deployed service is https://postdate.onrender.com,
linked to the `main` branch of `justinbautistaa/PostDate-main`. Deploys are manual.
The service uses the free plan, Atlas, Cloudinary and Gmail API delivery.
Do not replace Cloudinary with the service's temporary filesystem: uploaded
files there do not survive restarts and redeploys. Persistent server uploads
require a paid service with a mounted persistent disk. Browser localStorage
cannot serve as shared profile-photo storage for other members.

Run `node backend/scripts/checkDeployment.js` after a release for read-only
HTTPS, readiness, page, asset, origin and unauthenticated-access checks. These
checks do not replace verification with a dedicated member account. Never
commit test-account credentials or verification codes.

## Lost staff authenticators

An operator with trusted Render environment access can recover one active,
verified staff account after confirming the owner's identity and consent.
Set `STAFF_MFA_RECOVERY_EMAIL` to that exact account and
`STAFF_MFA_RECOVERY_REQUEST_ID` to a newly generated random 32-byte hex value,
then deploy. This startup action has no public HTTP endpoint. It clears the
old MFA factors and pending recovery proofs, revokes sessions, preserves the
password and role, and records a security event. Production staff login still
requires fresh authenticator enrollment before access is granted.

The request hash is stored on the account, so a restart with the same settings
does not erase the replacement authenticator. After successful enrollment,
clear both settings. Never reuse a request ID or run this for an account whose
owner has not been verified. Back up the new recovery codes privately.

## Selected services

| Purpose | Provider | Local preparation |
| --- | --- | --- |
| Same-origin website/API and TLS | Render | `render.yaml`, production static serving, `/healthz`, graceful shutdown |
| Database | MongoDB Atlas | Mongoose ownership checks, database-backed production rate counters |
| Verification and recovery email | Gmail API | Server-side HTTPS delivery with expiring one-use codes |
| Photo storage | Cloudinary | Signed server-side upload/delete, decoded and re-encoded WebP images |

Render's [free plan](https://render.com/docs/free) sleeps after inactivity and has an ephemeral filesystem. It is a preview option; choose a paid always-on service for a public launch after reviewing cost. Cloudinary avoids storing new photos on that filesystem. Atlas [free clusters](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) do not provide managed backups. Review [Resend's current limits](https://resend.com/pricing) and verify a sender domain before sending to real members. No plan upgrade is automatic here.

## Accounts and release procedure

For a new installation, keep `.env`, uploads, backups and dependency folders excluded by `.gitignore`. In Render choose **New → Blueprint**, connect the repository, and select this project's `render.yaml`. The template builds and serves the React site through the same Node/Express service, so the frontend needs no separate API URL. For the existing deployment, update its linked repository and manually deploy the reviewed commit.

1. Connect the offered Render and Resend plugins, or use those providers' dashboards. Create Atlas and Cloudinary accounts under your own identity. A verified sender domain you control is required for normal email delivery. Account credentials belong in provider secret settings, never chat or Git.
2. Put this reviewed code and its lockfiles in your repository. Before release run `npm ci --prefix backend`, `npm test --prefix backend`, `npm ci --prefix frontend`, `npm run build --prefix frontend` and the three npm audits. The active GitHub security workflow repeats local checks when pushed. Deployment is manual in the blueprint.
3. In Atlas, create a PostDate database and an application user restricted to that database's `readWrite` role. Use a TLS connection URI. Allow the Render service's documented outbound IPs, rather than opening access to all addresses. Do not use the database administrator credential for the app.
4. Review and import `render.yaml`. Set `MONGO_URI`, `MAIL_API_KEY`, `MAIL_FROM`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` through Render's environment settings. Render generates `JWT_SECRET`; rotating it signs everyone out. The app uses Render's `RENDER_EXTERNAL_URL` as its exact allowed origin. If you add a custom domain, set `CLIENT_URL` to that exact HTTPS origin without a trailing slash.
5. Configure `TRUST_PROXY` with the actual ingress proxy IPs/CIDRs, verified for the service, and ensure the backend cannot be reached outside that ingress. Do not guess or set `true`. Before public launch, verify different clients receive separate rate counters and a forged `X-Forwarded-For` cannot choose its counter. Without correct proxy settings the app uses the connection IP, which can group clients behind a proxy; this must be resolved against the real hosting topology.
6. Startup creates the shared counter and swipe/match indexes. If migrating an existing database, first check for duplicate swipe pairs and resolve them with a backup and deliberate migration. New swipes have a unique owner/target index, new matches a unique canonical pair key. Old duplicate match rows also need review. Existing members with the former fake verification flag must verify email again.
7. Existing local photos must be migrated before changing `STORAGE_PROVIDER` to `cloudinary`; switching the setting does not upload old files. New cloud photos use authenticated delivery and are fetched through the protected backend photo route. Convert legacy public Cloudinary assets with `node backend/scripts/migratePhotoPrivacy.js --apply`, then verify provider/CDN invalidation. The command without `--apply` only counts references. Already downloaded copies cannot be revoked.
8. Provision staff using `backend/scripts/createAdmin.js` from a trusted server environment. Never expose staff creation as a public endpoint. Test authorization with a member, a moderator and an administrator before launch.
9. For optional browser push, set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` using the stable values from your ignored backend environment. Keys can be generated by `backend/scripts/setupPush.js`; do not put the private key in GitHub, frontend variables, or chat. After HTTPS is live, enable push in Profile settings and test it with the site's tab closed on a supported browser/device.

## Launch acceptance checks

Local checks completed October 16, 2026: member/staff/admin authorization tests, block/unmatch and no-rematch tests, unread-message ownership and read acknowledgements, encrypted backup restoration into a disposable database, and frontend production build. The rating dialog was checked at 390×844 and 1280×800; close and submit controls stayed inside the viewport. Mobile chat, administration and About Us layouts were also inspected with sample data. These checks do not replace the hosted acceptance steps below.

- `/healthz` returns ready while the database is connected and unavailable otherwise. It exposes no credentials or database details. Configure an external uptime monitor for this endpoint; no external monitor has been registered here. Free preview sleep affects monitoring results.
- Sign up through the actual website, receive a real email, verify, sign in, upload/delete a photo, edit a profile, form a mutual match, and complete email recovery. Confirm old sessions fail after recovery or logout.
- Verify HTTPS, the production Secure/HttpOnly host-only cookie, same-origin API calls, blocked hostile origins, member/admin boundaries and per-client rate limiting.
- Verify Cloudinary uploads/deletes with the real account, including provider errors. Local automated tests mock external email and storage calls; they do not prove delivery or account permissions.
- Use provider logs without request bodies, query strings, cookies, tokens or email content. Add alerts for sustained error rates, database availability, mail delivery failures and storage quota. Never turn production debugging on to diagnose a credential problem.

## Backups and recovery drills

Prefer managed Atlas backups with an appropriate retention policy for production. The included application snapshot is a small-project fallback (64 MiB serialized payload limit), not a consistent point-in-time database backup. Pause writes during snapshotting. It does not capture provider photo assets, database users or cluster settings.

Generate a random 32-byte hexadecimal `BACKUP_ENCRYPTION_KEY` and keep it in a secret manager, separate from backup files. Configure it through the environment or ignored `backend/.env`. From the backend directory:

```powershell
node scripts/backupDatabase.js backups/postdate.encrypted
```

Output is AES-256-GCM authenticated encryption and refuses to overwrite a file. Upload encrypted files off-host with retention, access restrictions and monitoring; a file on Render's ephemeral disk is not a backup. `.encrypted` files and `backups/` are ignored by Git. No backup job has been scheduled because no database/backup destination is connected.

For a drill, set `POSTDATE_RESTORE_TEST_URI` to a distinct empty database whose name contains `restore_test`, then run:

```powershell
node scripts/restoreBackup.js backups/postdate.encrypted
```

The command cannot restore into a production-named or nonempty database. Verify records and indexes in the test database. Real recovery needs a separately reviewed process; the script deliberately does not overwrite production. Cloudinary assets need their own backup/retention strategy.

## Automated review

`.github/workflows/security-checks.yml` is ready for GitHub. The Anthropic reviewer remains a template until its repository secret and required approval environment are configured. See `SECURITY.md`. No external scan or penetration test has been performed.
