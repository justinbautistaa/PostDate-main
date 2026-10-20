# PostDate production security operations setup

Status: independent public health checks are active and a one-time encrypted production database backup and isolated restore drill have succeeded. Recurring backups and media recovery remain pending.

Update — October 20, 2026, 21:16 Asia/Manila: the first production database backup is now created and stored privately in Google Drive. The downloaded cloud copy matches the local encrypted file SHA-256. Its 19 collections and 514 documents were restored into a disposable local loopback-only `postdate_restore_test` database; serialized records and index keys/unique flags matched. The test database was stopped and removed by the temporary database helper. Drive metadata showed owner-only access (`shared: false`). Only encrypted bytes were uploaded; the encryption key remained local. The current configuration uses a process-only public DNS resolver because the system resolver refused SRV queries. An Atlas IP access entry was added by the user before this successful run. This is a verified one-time database backup and recovery drill, not an activated recurring backup job or a backup of Cloudinary media. Separate key custody in a password manager remains the owner's responsibility.

Free independent health checks: `.github/workflows/render-health.yml` runs the public Render readiness check approximately every fifteen minutes and can be started manually. It needs no secrets, database access or package installation. A failed check fails the workflow. GitHub Actions notification preferences control workflow-failure emails; delivery to the operational Gmail recipient is not configured by this workflow. It does not send the existing transition emails, preserve outage state or inspect deployment status. The desktop monitor remains enabled for those alerts. GitHub schedules can be delayed, and public-repository schedules stop after 60 days without repository activity. This is best-effort coverage, not a guaranteed monitoring SLA.

Validation on October 20, 2026: all 306 backend tests passed across 25 suites, including authorization, recovery, uploads, monitoring and backup tests. All 113 frontend tests passed across 27 suites in the final full run. An initial signup timeout passed in isolation; a subsequent messaging test exposed an asynchronous assertion race, corrected by waiting for the message-fetch effect before checking its arguments. No production application behavior changed.

## Encrypted backup job

Use a dedicated private runner with Node matching the backend engines requirement. Install from the committed lockfile with `npm ci --prefix backend --omit=dev`. Supply `MONGO_URI` using a database user restricted to reading PostDate's application collections. Supply a separate random 32-byte hexadecimal `BACKUP_ENCRYPTION_KEY` from a secret manager. Never reuse JWT, MFA or Cloudinary keys.

Run `node backend/scripts/backupDatabase.js /private-backup-path/postdate-TIMESTAMP.encrypted`, replacing the path and timestamp for every run. The command refuses to overwrite an existing file. Configure the runner's private storage permissions before running; Unix file mode alone does not establish Windows ACL protection.

Copy only the encrypted output to the approved off-host private destination. Keep the encryption key in a separate recovery location. Initially retain seven daily and four weekly successful backups, subject to the project's retention requirements. Alert on backup, transfer or scheduled-job failure. Do not declare success until the remote object exists and its checksum matches the local encrypted file.

The application backup has a 64 MiB serialized-data limit. It reads collections sequentially and is not a point-in-time transactional snapshot. Use managed MongoDB snapshots for stronger consistency or larger datasets. Cloudinary photo bytes require a separate provider recovery/backup plan; database records alone do not restore media.

## Restore drill

Use an isolated MongoDB test deployment with no production application access. Supply `POSTDATE_RESTORE_TEST_URI` targeting a new empty database whose name contains `restore_test`, plus the original backup encryption key. Run `node backend/scripts/restoreBackup.js /private-backup-path/postdate-TIMESTAMP.encrypted`.

Verify collection counts, IDs, dates, indexes and representative relationships. Measure elapsed recovery time and the age of recovered data. Record only counts and outcomes, never personal records or keys. The automated regression tests cover tamper rejection, wrong-key rejection and restricted restore targets, but a real off-host restore drill is still required. Never point the test restore at production.

## Independent monitoring

Run monitoring outside the monitored Render web service so an application outage cannot stop the check. A scheduled runner must support persistent private state and prevent overlapping runs. Install backend production dependencies and privately supply `MONITOR_EMAIL_TO` and only the sender configuration required by the selected mail transport. Do not copy the entire application environment or production database credentials to the monitoring host.

Schedule `node backend/scripts/monitorUptime.js` every five minutes. Preserve `backend/.cache/uptime-monitor.json` across runs for transition deduplication. Without persistent state, repeated alerts and missed recoveries are possible. Configure independent runner-failure notifications because this script cannot email successfully when its own mail credentials or execution fail.

For deployment alerts, the runner must read the latest deploy using narrowly scoped Render access and pass its actual ID/status using `--deploy-id` and `--deploy-status`. A health-only run does not detect failed deployments when an older version remains healthy. Never embed Render credentials in command arguments or logs.

## Live acceptance checklist

Use two disposable member accounts and one disposable staff account approved for testing. Check mutual matching and messaging, blocking and message denial, report visibility, photo upload/avatar/delete, session expiry, member denial of staff routes, and staff MFA. Send messages only between these test accounts. Record outcomes without copying private messages or profile data into reports. Local tests and public health checks do not replace these authenticated live checks.

## Activation inputs still needed

Google Drive's backup folder and uploaded encrypted file were verified as private. Keep file identifiers and detailed verification records in the ignored local backup report. Connector access alone does not create an unattended upload credential for a scheduled runner.

- Separate key custody in a password manager.
- A scheduled backup runner with narrowly scoped database and private storage access.
- A separate recovery plan for Cloudinary media.
- Disposable live test accounts accessible through the normal login flow.

After activation, perform a recovery drill and alert-delivery test, then record the verified recovery time, recovery point, responsible operator and test date.
