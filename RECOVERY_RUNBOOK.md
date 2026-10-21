# PostDate recovery procedures

Prepared October 21, 2026. These procedures do not reset an account or overwrite production by themselves. Record the responsible operator, decision, date and outcome in a private operations log.

## Lost authenticator

1. Ask the owner to use an unused recovery code first. Password recovery preserves MFA.
2. Open a private support case. Do not accept a password, inbox access, profile facts, urgency or an account name alone as proof of ownership.
3. Use an independent record established before the loss: for staff, the organization's recorded appointment and a callback through its previously recorded contact; for a member, a previously established recovery contact or other independently verifiable ownership evidence. Have a second trusted operator review the evidence and exact account. If no independent evidence exists, leave MFA enabled and escalate the case; do not improvise a bypass.
4. Record the case reference, evidence source, verifying and approving operators, exact account and owner's consent privately. Do not collect passwords, OTPs or recovery codes. Avoid retaining identity documents; follow the project's support retention policy.
5. Follow the member command in OPERATIONS.md or the staff startup recovery procedure in DEPLOYMENT.md, using a new request ID. Never run a broad database update or expose an HTTP recovery endpoint.
6. Have the owner sign in, enroll a replacement authenticator, store recovery codes privately and verify that the old session no longer works. Clear temporary recovery settings after success. Record the outcome. Staff enrollment is enforced at production login; members need to complete replacement enrollment themselves.

This defines the decision process; naming the actual support operators and approving their retention policy remains an owner task.

## Database and photo recovery

1. Select a successful encrypted backup and retrieve the key from separate recovery custody. Check the encrypted file SHA-256 against the recorded off-host checksum. Work in a private folder outside shared/synced project directories. On Windows, verify its ACLs; Unix file modes alone are insufficient.
2. Restore the database only to a new empty isolated database with `restore_test` in its name using `backend/scripts/restoreBackup.js`. Never use production as a drill target. Verify counts, index definitions and representative relationships. Keep the test application isolated from live email, push and user traffic.
3. Stage cloud photo bytes with `node backend/scripts/extractBackupMedia.js ENCRYPTED_ARCHIVE NEW_PRIVATE_FOLDER`. Supply `BACKUP_ENCRYPTION_KEY` privately. The command authenticates the archive, verifies checksums and references, refuses an existing destination and writes a manifest. It never uploads or overwrites live assets. Database-backed `/api/photos/` bytes remain in the database snapshot.
4. For a drill, use a separate Cloudinary account/cloud and isolated application. Upload the staged WebP files through the existing authenticated-delivery adapter, preserving `postdate/<filename without .webp>` public IDs and `overwrite=false`. Supply only the test cloud's credentials. Verify member-authorized photo delivery and rejection without a session. Review image counts and checksums. Do not change the production cloud setting to test recovery.
5. For an actual incident, compare the selected backup's age with current deletion and moderation records. Do not resurrect accounts or photos deleted after the backup. Prepare the exact database target, missing-asset list, handling of conflicting existing assets, maintenance window and rollback plan for owner approval. The normal upload adapter refuses overwrites; resolve conflicts individually rather than enabling global overwrite.
6. After approved recovery, verify representative profiles, permissions, matches and photo delivery before reopening traffic. Record recovery duration and age of recovered data. Securely remove temporary plaintext staging and test resources according to the private retention policy.

The application backup reads collections sequentially and is limited to 64 MiB serialized data plus the existing 24 MiB cloud-media download bound. It is not a transactional point-in-time snapshot. Use managed snapshots and a provider recovery plan when these limits are insufficient.

## Backup custody and retention

Keep the backup encryption key in an owner-controlled password manager, separate from the archive destination. A second trusted custodian should be able to locate it during an incident. Do not rotate it without preserving the keys needed for retained archives. Never paste it into chat or commit it.

Default review target: seven daily and four weekly successful archives, with a monthly isolated restore drill. Do not delete older copies until a newer off-host checksum and recovery drill succeed. Apply retention only to exact tracked backup objects, with the owner-approved privacy retention policy taking precedence. GitHub artifact expiry in the optional private-runner template is not the full weekly retention policy.
