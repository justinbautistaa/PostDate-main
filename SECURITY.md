# PostDate security and deployment

Security hardening reviewed on October 6, 2026. This is a source-code review and local validation, not a penetration test or a certification that the hosted service is secure.

## Deployment requirements

1. Use a supported Node 24 LTS release (24.15 or later). Install from the committed lockfiles with `npm ci`, `npm ci --prefix backend`, and `npm ci --prefix frontend`.
2. Configure `backend/.env` locally using `.env.example`, or inject environment variables through your hosting provider. Generate a cryptographically random `JWT_SECRET`; never use the example test secrets. Existing bearer sessions are invalidated by this change. Member accounts verified with the old universal code must complete real email verification; a legacy `isVerified` flag alone no longer grants access. Staff provisioned through the administrator script retain their explicit trusted verification.
3. Configure Gmail (`MAIL_MODE=gmail`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`), SMTP, or Resend (`MAIL_MODE=resend`, `MAIL_API_KEY`, `MAIL_FROM`). Missing email settings return 503 for code delivery; production refuses to start without them. Gmail accepted a delivery test on October 16, 2026; final hosted delivery and inbox/spam placement still require verification. Automated tests mock provider calls.
4. Set `NODE_ENV=production` and `CLIENT_URL` to the exact public HTTPS origin, without a trailing slash. Build with `npm run build --prefix frontend`, then run `npm start --prefix backend`. Express serves `frontend/dist`, the API and uploads on the same origin. Terminate HTTPS at your host/proxy. Do not deploy the Vite development server or expose the Node inspector.
5. Leave `TRUST_PROXY` empty for direct connections. Behind a proxy, configure only its actual IPs/CIDRs and prevent direct access to the backend. Never set it to `true` or trust arbitrary forwarded headers.
6. Require MongoDB authentication, restrict the application credential to `readWrite` on the PostDate database, use TLS for remote connections and restrict network access to the backend. Never ship MongoDB credentials to the frontend. These live infrastructure settings were not changed here.
7. Use the Cloudinary adapter for new photos on ephemeral hosts, or explicitly select local storage with a persistent backed-up disk. Photo requests now require a valid session and current visibility/match permissions. New cloud uploads use authenticated delivery and are proxied through the backend without exposing signed provider URLs. Existing public cloud assets need `scripts/migratePhotoPrivacy.js --apply` and provider cache invalidation; verify old links against the live provider. Local files must be migrated before switching storage providers.

Production startup checks required settings and refuses short signing secrets, missing database/email configuration, HTTP client origins and inspector flags. Secret strength still depends on generating a random value. Production uses HttpOnly, Secure, SameSite=Strict, host-only cookies; the frontend and API must share the configured origin.

## Controls and applicability

| Requested control | Implementation / scope |
| --- | --- |
| Admin routes and server permissions | Every admin endpoint checks the current database account and role. Role changes and suspensions take effect on the next request. Admin-only mutations reject moderators; members can only change their own profile. |
| RLS | This app uses MongoDB, which does not provide PostgreSQL RLS policies. Ownership filters use the authenticated user ID. Direct database access must remain restricted to the server. A move to PostgreSQL/Supabase would require separate RLS migrations. |
| Email verification | Per-account random six-digit codes, HMAC storage, five-minute expiry, five atomic attempts, one-time consumption and account resend cooldown. The universal `0000` bypass is removed. |
| Passwords | bcrypt cost 12 for new accounts. Minimum 12 characters; inputs above bcrypt's 72-byte limit are rejected rather than silently truncated. Existing hashes remain compatible. |
| Tokens and API secrets | Credentials live in HttpOnly cookies, never in response JSON or browser storage. Only user ID/role metadata is kept in memory. Login restores via the server; logout revokes all account sessions. Mail and signing secrets remain server-side. |
| CSRF and CORS | An exact origin allowlist and required custom header protect all API mutations, including login. This forces preflight and blocks hostile forms/scripts. No wildcard credentialed CORS. |
| Environment files | `.env` and `.env.*` ignored at any depth, except `.env.example`. No tracked `.env` files or secret patterns were found in the working tree or included archive. This does not prove all Git history is clean; rotate any previously exposed credentials. |
| Logging | Auth, driver and request errors omit exception details, bodies, cookies, query strings and tokens. The obsolete frontend signup credential log is removed. Host/proxy/access logs need the same policy. Authorized staff audit records deliberately retain moderation decisions. |
| SQL / NoSQL injection | No SQL driver or SQL statements are present. Request operator/prototype keys are rejected; handlers build allowlisted filters and escape regex search terms. |
| Validation / XSS | Server validates credentials, IDs, bounded profile fields and enum selections. React renders text through escaping; no active raw-HTML rendering was found. Helmet supplies a CSP forbidding inline scripts and external script sources. Inline styles remain allowed because the existing UI uses them. |
| Production debugging | Generic API errors, no source maps, Mongoose debugging off, inspector rejected at startup, only frontend build/upload directories served. |
| Rate limiting | General API and stricter auth limits apply before route handlers. Account verification additionally limits guesses and resends. Production IP counters are shared in MongoDB, use fixed windows and expire through a TTL index; IP keys are HMAC digests. Database failures fail closed. Development/test counters remain in memory. Verify trusted proxy configuration against the live ingress topology. |
| Uploads | Bounded multipart fields, file count and byte size; format checked by decoding with sharp, pixel limit, animated images rejected, re-encoding to WebP strips metadata/appended content. Random filenames and ownership checks protect writes/deletes. |
| Webhook signatures | No webhook endpoints exist in this app. Unknown webhook routes return 404. Add provider-specific raw-body signature verification, replay checks and tests before introducing a webhook. No signature verifier is claimed for a nonexistent integration. |
| Dependencies | Runtime and development dependencies updated; vulnerable nodemon chain replaced by Node watch mode. Re-run npm audit regularly and review future advisories. |

Password recovery now uses emailed HMAC-protected codes, five-minute expiry and five atomic guesses, then a ten-minute single-use random reset credential held only in frontend memory. Password changes revoke previous sessions and cannot reactivate suspended accounts. Profile edits, filtered discovery, idempotent likes/passes and participant-only match history now use authenticated server routes. Public profiles omit email, legal surname and birthdate. Landing statistics use actual aggregate counts.

## Verification

Final local validation: 163 tests passed across eight suites; the production frontend build passed; root, backend and frontend npm audits each reported zero known vulnerabilities, including development dependencies. `git diff --check` passed.

Run `npm test --prefix backend` and `npm run build --prefix frontend`. Auth and admin tests use a disposable MongoDB instance, the same application factory as production, and mocked mail delivery. Tests cover permissions, ownership, code guessing/expiry/reuse, logout revocation, CSRF/CORS, NoSQL operators, password hashing, uploads and safe errors. Run `npm audit` in the root, backend and frontend to check both runtime and development dependencies.

## Anthropic security review

The requested `anthropic/codex-code-security-review` was not found as an installed skill. The available upstream project is [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review). A pinned configuration is provided in `.github/workflows/anthropic-security-review.yml.example`; it is a template, not an executed Anthropic review.

To enable it, review the template, rename its extension to `.yml`, add the repository secret `CLAUDE_API_KEY` and configure the `security-review` GitHub environment with required reviewer approval. Apply the `security-review` label to a trusted same-repository PR. No PR comments are enabled. The workflow refuses malformed/error review output and findings rather than treating a failed scan as clean. Upstream warns that its reviewer is not hardened against prompt injection; do not enable it on untrusted fork code. The action and its internal dependencies still require periodic review.

Live HTTPS, database access rules, delivered email, cloud storage permissions, GitHub secret/environment setup, trusted-proxy rate-limit verification, scheduled off-host backups/monitoring and penetration testing remain deployment work. See DEPLOYMENT.md for the selected services, release checks and encrypted recovery drill. Do not treat passing local tests as verification of those external systems.
