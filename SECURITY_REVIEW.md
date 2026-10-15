# PostDate security review

Reviewed 28 September 2026. Scope: this local Express/MongoDB/React project, its installed routes, browser session handling, dependency lockfiles, and production build. This is a local code review and regression test run, not a penetration test or a guarantee against compromise.

## Changes and evidence

| Requested protection | Implementation / scope |
| --- | --- |
| Admin routes and server permissions | Every staff API authenticates against MongoDB and reads the current role, verified state and active state on each request. Admin-only sections also check the role in the handler. Tests cover unauthenticated access, regular accounts, staff demotion and deactivation. |
| RLS | This project uses MongoDB, not PostgreSQL/Supabase. No SQL RLS switch exists here. Profile writes derive the owner from the authenticated session, not client user IDs; tests attempt cross-user tag/photo changes. Discovery deliberately shares limited profiles with other verified members. Database network access and a least-privilege database account must still be configured by the deployment owner. |
| Verified email | Login requires verification. Six-digit codes are keyed digests, expire after five minutes, allow five guesses, and are consumed once. Email delivery requires working Gmail/SMTP credentials; it was not tested against a real inbox during this review. |
| Password hashing | New passwords use salted bcrypt with cost 12. Server validation rejects blank passwords, values under eight characters and values over bcrypt's 72-byte limit. Existing hashes remain valid; no password or existing account was changed. |
| Browser credentials | Login creates a random 256-bit opaque session. Only its SHA-256 digest is stored in MongoDB. The cookie is HttpOnly, SameSite=Lax and expires in eight hours; in production it uses Secure and the __Host- prefix. No login token is returned in JSON or placed in browser storage. Old localStorage tokens are removed on app load. |
| Revocation | Logout deletes the session before reporting success. Password resets increment the account version, invalidating prior sessions. Expiry is checked on every request independently of MongoDB TTL cleanup. Old Bearer/JWT logins are no longer accepted. |
| CSRF and CORS | All writes, including login/logout/signup, require X-PostDate-Request: 1. Browser scripts from another origin must pass an exact-origin CORS preflight; unlisted origins and cross-site writes are rejected. Cookies add SameSite protection. Production origins must be exact HTTPS origins. This is the custom-header CSRF pattern, not a claim that SameSite alone prevents CSRF. |
| Server-only secrets | Mail credentials and the existing JWT_SECRET configuration key remain backend-only. The latter now keys verification and rate-limit digests; JWT login tokens have been removed. Frontend API configuration defaults to /api, not secret credentials. |
| Environment files | Ignore rules cover .env, .env.* (except examples), key/certificate files and common backups. HTTP dotfile paths are rejected. This folder has no .git repository, so prior commits, remote repositories and already-leaked secrets could not be inspected or erased. |
| Sensitive logs | Request error logs emit fixed event labels, not error objects, URLs, bodies, credentials or provider responses. Activity paths use route templates; unknown paths are recorded as unmatched. Console mail mode no longer prints codes or recipient addresses. Tests send canary secrets in malformed JSON and URLs and check output. |
| SQL/NoSQL injection | No SQL database or SQL query builder is used. All MongoDB filters are constructed server-side from validated scalars. Request objects reject operator keys, dotted keys, prototype keys and excessive nesting. Search text is literal rather than an injected regular expression. |
| Form validation | Server-side type/length checks cover signup, email, passwords, tags, coordinates, IDs and filters. JSON body size and multipart field/file/part sizes are limited. Roles, verification flags and password hashes are never taken from signup inputs. |
| XSS | React renders profile content as text. Production responses use a CSP restricting scripts to self, disallowing inline script attributes, frames, objects and base URLs. Images are re-encoded JPEGs. Existing React inline styles require style-src unsafe-inline; script-src does not allow unsafe-inline or unsafe-eval. There is a regression test for HTML-like profile content. |
| Production behavior | Production serves only the built frontend and API through Express. Source maps are disabled. Startup rejects weak/default secrets, unauthenticated production MongoDB URIs, missing mail settings, HTTP client origins and inspector/DEBUG flags. The server binds to 127.0.0.1 by default. |
| Rate limits | Per-IP general/auth limits apply before expensive API operations. MongoDB-backed per-account limits cap login attempts at 10 and verification/recovery email requests at 5 per 15-minute window across app instances. General IP counters remain process-local; use a shared edge limiter or shared store for multi-instance deployment. Proxy headers are not trusted by default. |
| Uploads and photo access | JPEG/PNG/WebP content is decoded, pixel-limited, resized, stripped of metadata and re-encoded. SVG or disguised non-image content fails. Uploads are limited to six files of 5 MB each per request and 30 stored profile photos. Photo reads require an authenticated verified member, a verified active owner and a current profile reference. Legacy disk photos receive equivalent access checks and re-encoding. Private pictures are not promised: profile photos remain visible to other verified members by design. |
| Webhook signatures | No webhook handlers are installed. Unsupported webhook paths return 404. A signing implementation must match the provider's actual raw-body signature and replay rules before any future webhook is enabled; no fictitious generic webhook was added. |
| Dependencies | Removed unused jsonwebtoken, updated compatible backend dependencies, upgraded react-router-dom to 7.18.4 to address audit findings, and updated lockfiles. Root, backend and frontend audits reported zero known advisories after changes. Audits do not prove that undisclosed vulnerabilities are absent. |

## Validation

Final local results: 50 backend tests and 20 frontend tests passed. The production build passed. Root/backend/frontend npm audits each reported zero known vulnerabilities. Production-mode HTTP smoke checks passed for SPA/assets, CSP headers, dotfile denial and unauthenticated admin denial. A comparison against configured backend secret values found no matching values in scanned source or frontend build files; this is not a complete historical secret scan.

Run from the project root:

~~~powershell
npm.cmd run security:check
~~~

This runs backend and frontend tests, builds the frontend, and audits all three dependency trees. Database tests use disposable MongoDB instances, never the application's configured database. Tests mock mail and do not send real email.

## Production setup still required

- Build with npm.cmd run build. Set NODE_ENV=production and CLIENT_URL to the exact HTTPS site origin. Serve the built UI and /api on the same origin through this backend behind an HTTPS reverse proxy. Do not deploy the Vite development/preview server as the production host.
- Keep the proxy-to-backend service private. Configure trust proxy only for the exact trusted proxy topology; otherwise forwarded client IPs must not be accepted. Use an edge request/body limit and a shared rate-limit store for scaled deployments.
- Configure a MongoDB account scoped to this application database, enable database authentication, restrict inbound network access, and use TLS for remote database connections. MongoDB permissions/network state were not changed by this review.
- Configure the sender's Gmail App Password or authenticated SMTP and verify actual delivery. TLS is required for SMTP transport. Secrets must be stored in the hosting provider's secret store and never published with the repository.
- Existing sessions must log in again after this update. Existing account passwords and data are retained. Profiles with unsafe/unreferenced legacy images may no longer serve those images.
- Back up the database, patch the operating system/runtime, maintain dependency checks, and rotate any credentials that were ever exposed. There is no deployment target or Git history attached here to verify those controls.

## Requested external scanner

The exact anthropic/codex-code-security-review identifier was not found. Anthropic publishes [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review), a Claude GitHub Action requiring a Claude API key and a GitHub repository. Neither is configured for this folder, so that external scanner was not run. Its documentation also cautions that it should review only trusted PRs. This report describes the local review and tests actually performed, not an external scanner result.

## References

- [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MongoDB client-library practices](https://www.mongodb.com/docs/drivers/client-libraries-best-practices/)
