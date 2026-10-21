# PostDate review — October 20, 2026

**Historical record:** SECURITY_ACCEPTANCE_2026-10-20.md subsequently confirmed live disposable-account checks and an off-host production database/media archive with an isolated restore. Those results supersede the unverified items below. See FIX_STATUS_2026-10-21.md for follow-up status.

## Verified issues fixed

1. Photo deletion previously read a gallery and saved a replacement array. Concurrent uploads/deletions could lose each other's changes; selecting a photo as avatar during deletion could leave an avatar referencing a removed image. Deletion now atomically checks membership, avatar exclusion and minimum gallery size, then pulls only the requested path. Avatar changes also require current gallery membership in the same atomic update. Conflicts return 409 without deleting the file.
2. The admin self-role-change guard compared ObjectId strings case-sensitively, while MongoDB accepts uppercase hexadecimal IDs. IDs are now normalized before comparison, preventing self-demotion through alternate casing.

Evidence: 96 backend tests passed across the feature and admin suites, including controlled avatar/delete races, parallel deletions, retained photo bytes and uppercase-ID self-role changes. Root, backend and frontend npm audits each returned zero known vulnerabilities on this date. No real account or photo was changed by these tests; databases and images were disposable fixtures.

## Previously fixed

The missing discovery photo was restored from its exact local original after explicit approval. Photo loading now retries transient failures twice, and discovery profile dialogs manage keyboard focus. See MEMBER_LIVE_TEST.md for live-check scope and limits.

## Remaining operational risks

- Local monitoring stops when the workstation or Codex is unavailable. Continuous coverage needs an always-on external host.
- A production off-host backup and restore have not been verified. Local encrypted restore tests do not establish production recoverability; the backup destination and access still need configuration.
- Live two-account tests for new messages, matching, blocking, uploads and reports still need disposable accounts and bounded test actions. Existing history and read-only member/admin views have been checked.
- MFA recovery tooling requires an independent ownership-verification process. No live MFA reset was performed by this review.
- Production analytics include the user-requested synthetic demonstration data. Demo labels identify sample accounts; remove the tracked dataset after the demonstration or use a separate demo deployment when evaluating real usage.

These findings are a scoped code review and regression check, not a guarantee against all vulnerabilities or production failures.

## Render inspection — October 20, 2026, 12:34 UTC

The deployed service srv-db8s614s728c73aspirg is live on commit eb5e1589af6faef7b964a07f2ceca50eb2bd27e2 (deployment dep-dbblmrm7bikc739001r0). The public deployment smoke check passed health readiness, frontend routes/assets, unauthenticated API rejection, untrusted-origin rejection and unknown-API handling. Recent startup logs confirm database connection and port 10000 binding; the queried error logs returned no entries. These observations do not prove every member workflow works.

Available current metrics showed about 82.5 MiB memory against a 512 MiB limit and 0.0022 CPU usage. HTTP request-count and latency metrics returned no data, so no production latency conclusion is drawn. The browser rendered the login page; an authenticated session was not available for further member testing.

No new Render fault was reproduced in this inspection, and no deployment/settings changes were made. Operational gaps remain: the service uses the free plan, monitoring depends on the desktop being available, and production backup/restore is not verified. Concurrent image uploads have not been load-tested against the free instance memory limit.
