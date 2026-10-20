# Account recovery and operations

## Input validation

The API rejects duplicate/nested query values and non-object request bodies. Pagination, ages and reporting-window parameters must use decimal whole-number text within bounds; letters, signs, fractional values and exponent/hex notation are rejected. Distance accepts a bounded nonnegative decimal. Ratings require numeric integers from 1 to 5, coordinates require finite numbers within latitude/longitude bounds, birthdates require real calendar dates and adult eligibility, and email fields use email syntax and length checks. Text fields retain their field-specific limits and allowed selections. Verification codes stay strings so leading zeros are preserved. MFA enrollment accepts six digits; recovery codes retain their hexadecimal letters. Browser restrictions supplement server checks; they are not the security boundary. These checks validate supported formats, not the truth of user-supplied names, locations or content.

## Incorrect-password throttling

Login allows at most five incorrect email/password attempts per normalized email in a 15-minute window. Later requests return HTTP 429 with `Retry-After` and a retry duration displayed by the login form. The remaining window can be shorter than fifteen minutes. Known and unknown emails use the same budget and responses. MongoDB stores only a keyed digest and counters; atomic reservations prevent parallel requests from bypassing the limit. Correct password checks release their reservation before continuing to MFA or account-status checks. They do not erase earlier failures in the same window. Existing shared login/appeal and per-IP limits continue to apply. No permanent account suspension or MFA change occurs.

## Member MFA recovery

Members should first use an unused MFA recovery code. Password recovery intentionally preserves MFA. If both factors and recovery codes are lost, an operator must independently verify ownership through an established support process. Access to an inbox, an account name or a password alone is not sufficient evidence to remove the second factor. Record the evidence in the private support case; do not store identity documents, passwords or codes in this repository.

After verification, an operator with database access can set these process-only variables privately and run `node backend/scripts/recoverMemberMfa.js`:

- `MONGO_URI`: the intended database, supplied through secure configuration.
- `MEMBER_MFA_RECOVERY_EMAIL`: the verified member's email.
- `MEMBER_MFA_RECOVERY_REQUEST_ID`: a new random 32-byte hexadecimal request identifier; retain it for idempotent retries.
- `MEMBER_MFA_RECOVERY_CASE`: a non-sensitive support reference, letters/numbers/dashes/underscores only.
- `MEMBER_MFA_OWNERSHIP_VERIFIED=true`: the operator's explicit attestation after independent verification.

This is an operator tool, not a public endpoint or an automatic reset. It refuses staff, inactive, unverified and deletion-pending accounts. It preserves the password and role, increments the session version, removes old MFA factors/challenges/push devices and records the support reference in a durable audit collection. Reusing the request cannot reset a replacement authenticator. Have the owner sign in and enroll a replacement promptly. Remove the temporary operator variables afterward. Deployment alone does not recover any account.

## Demo-data cleanup

Admin user/staff lists label sample records as Demo account. The hosted demo is tracked by the `postdate-dashboard-demo-v1` marker and exact user IDs. Keep `SEED_DEMO_DATA=false`.

Run `node backend/scripts/cleanupDemo.js` with securely supplied database configuration to preview counts. It changes nothing by default. After reviewing the plan and obtaining authorization to permanently remove the demo, the operator can run:

```powershell
node backend/scripts/cleanupDemo.js --apply --confirm-demo-removal
```

The tool refuses altered markers, non-demo emails, real/demo interactions, real staff follow-up notes about demo members and uploaded photos. These cases require manual review. It removes only the tracked demo accounts and their wholly demo-owned data. It does not delete real accounts or a real moderator's audit records. A partially failed removal requires manual review; never use a broad email-domain delete as a substitute.

## Email monitoring

`node backend/scripts/monitorUptime.js` checks the live health endpoint with bounded retries to accommodate cold starts. It uses the local Gmail/SMTP sender already configured in ignored `backend/.env`, the recipient in ignored `backend/.env.monitor`, and state in ignored `backend/.cache/uptime-monitor.json`. It emails only on failure/recovery transitions, not on every healthy check. `--test-email` sends a delivery test. Failed delivery leaves state unchanged so the alert can be retried. Never put sender passwords in an automation prompt.

The scheduled Codex check also reads the latest Render deployment and passes its ID/status to the script. Failed deployments are deduplicated and a subsequent live deploy sends recovery notice. A locally scheduled monitor requires this computer and the desktop app to be running; move the script and protected sender configuration to an always-on monitoring host for continuous coverage. Mail acceptance does not guarantee inbox placement.

## Backup verification

The regression suite encrypts the entire sample dataset, restores it into a separate empty test database and compares every collection count. It also verifies preserved IDs/dates and unique indexes and rejects altered/wrong-key backups. This is a local recovery drill, not evidence of a production off-host backup.

Use `backend/scripts/backupDatabase.js` with a separate `BACKUP_ENCRYPTION_KEY` to create an encrypted production backup. Store the backup off-host and the key separately. Restore only into an empty database whose name contains `restore_test`, using `backend/scripts/restoreBackup.js` and `POSTDATE_RESTORE_TEST_URI`. Do not overwrite production as a test. Production backup access and the off-host destination must be configured and tested separately.
