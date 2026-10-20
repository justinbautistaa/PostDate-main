# PostDate review — October 20, 2026

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
