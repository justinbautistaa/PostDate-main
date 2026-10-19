# PostDate security review

Reviewed October 18, 2026 (Asia/Manila). Scope: the local Express/MongoDB/React source, active routes, authentication and recovery, authorization, uploads, browser transport, dependency lockfiles, and automated regression tests. This is a code review and local validation, not an independent penetration test or production certification.

## Findings fixed

- Production startup and HTTP middleware validate an exact HTTPS frontend origin. Production rejects recognizable placeholder JWT secrets. CSP forbids base URLs and restricts form submissions to the same origin. Mutation checks reject cross-site Fetch Metadata, missing verification headers and untrusted origins.
- The existing account limiter was not mounted on authentication routes. Login and password-authenticated appeals now share a normalized-email budget of 20 attempts per fixed 15-minute window. Verification/recovery delivery have separate five-request budgets; code confirmation has separate 20-request budgets. These supplement IP limits and the five-attempt limit on each emailed code. MongoDB stores keyed digests rather than raw email addresses. Startup initializes unique and TTL account-counter indexes before accepting traffic. Store errors fail closed.
- Authenticated photo delivery outside /api now has the general IP rate limiter before authentication and cloud/disk work.
- Push subscription ownership is part of the atomic upsert filter. A competing account cannot overwrite a device subscription between the initial lookup and write; the unique endpoint index causes a conflict instead. A regression test simulates this race.

## Controls reviewed

| Area | Current implementation |
| --- | --- |
| Passwords | Salted bcrypt with cost 12; new passwords require at least 12 characters and at most 72 UTF-8 bytes. |
| Sessions | Eight-hour HS256 JWTs restricted to the configured issuer/audience and stored in HttpOnly, SameSite=Strict cookies. Production uses Secure and the host-only __Host-postdate name. Each protected request rechecks current account state, role, session version and MFA requirement in MongoDB. Logout and password reset increment the session version. No bearer-token login or frontend token storage is used. |
| MFA | TOTP secrets encrypted with AES-256-GCM using a separate key; bounded expiring challenges; atomic replay counters and one-use hashed recovery codes. Staff MFA is required in production. Password recovery does not disable MFA. |
| Recovery and email | Emailed HMAC-protected codes expire in five minutes, permit five atomic guesses and are consumed once. Recovery then creates a random ten-minute single-use reset credential. Reset cannot reactivate a suspended account. Provider calls are mocked in automated tests. |
| Authorization | Protected routes check authentication and current roles. Profile writes derive ownership from the session. Tests cover participant-only chats, private plans/reports/exports, staff restrictions, role changes, blocks, hidden profiles and account deactivation. |
| Input and errors | Bounded JSON/multipart inputs, scalar validation, allowlisted updates, operator/prototype-key rejection, escaped search patterns and generic unexpected errors. Raw credentials, request bodies and driver errors are not logged by the error handler. |
| Uploads | Up to 10 files with an aggregate 50 MiB byte budget per request and 30 photos per account. Sharp checks MIME against decoded format, rejects animation, limits input to 16 million pixels, resizes and re-encodes WebP without metadata. Random filenames; authenticated photo reads check owner availability, visibility and ended matches. Cloud assets use authenticated delivery. |
| Browser | React text escaping, same-origin script CSP, no raw-HTML rendering found, exact-origin CORS and custom-header CSRF checks. Inline styles remain allowed for the existing UI. |
| Abuse controls | Production IP counters and account counters use MongoDB and expire through TTL indexes. Authenticated live reads have a separate account budget. Trusted proxy configuration still requires deployment-specific verification. |
| Privacy and backups | Versioned privacy consent, discovery visibility, allowlisted own-data export, opt-in push without message contents, and password/MFA-confirmed deletion with a durable cleanup queue. Backup tooling uses AES-256-GCM and restricts restore drills to empty test databases. |
| Secrets | Only example environment files are tracked. A targeted working-tree scan found no matches for common private-key, AWS access-key, GitHub token or Stripe live-key patterns. This is not an exhaustive secret scan or a review of repository history. |
| Webhooks | No webhook handlers exist; unsupported API routes return 404. Future handlers need provider-specific signature and replay validation. |

## Validation

- Backend: 286 tests passed across 20 suites; the push-race suite also passed separately (16 tests).
- Frontend: 110 tests passed across 26 suites.
- Frontend production build passed.
- Root, backend and frontend npm audits: zero known vulnerabilities, including development dependencies, at review time.
- git diff --check passed.
- Read-only HTTPS smoke checks passed against https://postdate.onrender.com: health, public pages/assets, CSP/HSTS, unauthenticated access denial, untrusted-origin denial and unknown API routes. This verifies the currently hosted version, not deployment of these local edits.

Tests run against disposable local MongoDB instances and mocked external providers; no live account or stored password was changed. Sandbox restrictions initially prevented local test connections/cache operations; rerunning with the required access succeeded.

## Deployment verification still required

Follow-up October 19, 2026: 301 backend tests across 24 suites and 110 frontend tests across 26 suites passed. Added independently verified operator member-MFA recovery, a preview-first marker-scoped demo cleanup tool, admin demo labels, transition-only operational email monitoring, and a full demo-dataset encrypted restore regression. The frontend production build passed. A monitoring delivery test was accepted by the configured sender; inbox placement is unverified. A local Codex monitor is scheduled every 15 minutes and requires the workstation/app to remain available. No real member MFA was reset and no live demo records were removed. See OPERATIONS.md for commands and limitations.

These local edits are not deployed. Verify the deployed revision, HTTPS/cookies, database authentication/TLS and network restrictions, least-privilege provider credentials, trusted ingress/proxy topology, real email delivery, cloud photo migration/invalidation, backup restoration off-host, monitoring, and retention/support procedures. Never infer those settings from passing unit tests or a public health endpoint. The project's read-only deployment smoke check does not validate authenticated accounts or provider access controls.
