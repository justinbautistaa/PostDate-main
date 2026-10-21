# Activate backups outside the Render web service

The optional `.github/workflows/private-backup.yml` is prepared, not activated. It refuses to run in a public repository. PostDate's current application repository is public, so this workflow will be skipped there. Never upload member archives to the public repository's artifacts or issues, even when encrypted.

1. Create an owner-controlled private operations repository containing the reviewed backend source, lockfile and workflow. Restrict collaborators and workflow-edit permissions. This runner works independently of the Render web instance and desktop.
2. Create its `postdate-backups` GitHub environment. Enter `BACKUP_MONGO_URI` (read-only access to application collections), `BACKUP_ENCRYPTION_KEY` and the three `CLOUDINARY_...` secrets privately in that environment. Keep a separate recovery copy of the key in a password manager. No production JWT/MFA or email keys are needed. Restrict trusted branches; unattended schedules cannot wait for a human environment approval.
3. Establish narrow Atlas network access for the runner. Do not open Atlas to all IPs for a changing hosted-runner address. If necessary use a trusted runner with fixed egress and change `runs-on`. Review runner and artifact usage limits before activation; no paid subscription is authorized by this preparation.
4. Set repository variable `POSTDATE_BACKUPS_ENABLED=true`. Run **Private encrypted backup** manually. It creates an encrypted database/media archive, uploads it, downloads the stored copy and checks SHA-256. Missing secrets or checksum failures fail the job. Only encrypted archive bytes and checksums are uploaded.
5. Confirm private artifact access and workflow-failure notifications to the responsible operator. Keep the public health workflow in the application repository. This backup workflow does not send Gmail transition alerts or inspect Render deployments.
6. Perform the isolated database and photo drill in RECOVERY_RUNBOOK.md. Record duration, backup age, counts and checksum privately. Observe the next scheduled run, targeted for 22:00 Asia/Manila. Schedules can be delayed or disabled; monitor missed backups independently.

Artifacts request 30-day retention, subject to repository policy. Export selected verified weekly archives to approved private long-term storage before expiry. Seven-daily/four-weekly retention is not automated here. Deploying the website to Render does not activate this workflow.

Action inputs: [upload-artifact](https://github.com/actions/upload-artifact/tree/v4.6.2) and [download-artifact](https://github.com/actions/download-artifact/tree/v4.3.0). The workflow pins both to verified release commits.
