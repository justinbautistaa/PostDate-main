# PostDate follow-up — October 21, 2026

## Changes prepared

- Signup and profile uploads share one multipart slot per process. A competing batch receives 503 and Retry-After before buffering. JSON signup and normal reads remain available. Disconnecting during processing retains the slot until that work settles. This bounds simultaneous batches, not total memory or slow-client duration.
- Backup photo extraction verifies archive authentication, expected references and checksums before writing to a new private staging folder. It refuses existing destinations and never overwrites Cloudinary or live uploads.
- RECOVERY_RUNBOOK.md defines independent MFA ownership verification, key custody and isolated database/photo recovery.
- The backup workflow is prepared and disabled in the public repository. PRIVATE_BACKUP_SETUP.md lists private repository, credentials, network access and activation checks. It does not establish active unattended backups or Gmail alerts.
- Project documents distinguish completed October 20 acceptance from remaining operations work. Windows verification can use a compatible bundled Node without changing system Node.

## Verification

The first targeted run passed all eight new upload-capacity and media-staging checks. The production frontend build passed. Dependency installation reported zero known vulnerabilities in backend and frontend. Final full-suite and deployed-commit results are recorded in the pull request and this chat after completion.

## Remaining owner configuration or separate action

- Activate private backups, verify failure/missed-run alerts, keep the key separately and complete the remote photo restore drill. The current workspace has no private environment files or backup credentials.
- Select always-on hosting if needed; no paid plan change is included.
- Demo records remain by earlier request. Preview the tracked cleanup plan using private database access and approve exact counts before permanent deletion. This patch removes no production accounts or images.
- Name support operators and finalize support/backup retention. No live MFA reset is included.
- Sustained load and real Cloudinary failure testing remain outside the local scope. The upload guard is not a production throughput or memory guarantee.
