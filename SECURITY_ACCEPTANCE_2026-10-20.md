# PostDate security acceptance — October 20, 2026

Target: the live Render deployment at https://postdate.onrender.com. Current application commit: 9bdb5f9. Checks used disposable data or read-only owner-provided sessions.

## Verified behavior

- Signup creates an unverified member; login remains unavailable until email verification. An owner-approved inbox received the code, successful verification consumed it once, and replay was rejected.
- Reciprocal discovery likes create one match. Repeating a like does not create a duplicate match. The matched test members can exchange messages; blocking prevents further messages.
- Members cannot access the staff overview. A reporter sees their own report and another member cannot see it through the member-report endpoint.
- Generated test photos upload successfully; the owner can change the avatar and delete a non-avatar photo. All test photos were removed afterward.
- Five failed passwords use the account's failure budget. The next attempt returns HTTP 429 and retry timing. The browser displays the cooldown. Separate regression tests cover concurrent requests, normalized emails, correct passwords and window expiry.
- Malformed numeric filters, duplicate/nested query values and out-of-range ages/page sizes are rejected. Valid numeric queries still work. Verification strings retain leading zeros, and hexadecimal recovery codes remain supported.
- Staff overview and all available sections loaded. Member emails were masked; settings showed MFA enabled. The staff browser was redirected away from the admin-only page. The owner completed MFA before inspection; this is not an independent replay/bypass test of the MFA challenge.
- Deployment smoke checks passed health, frontend routes/assets, authentication denial, origin rejection and unknown-API handling.
- An encrypted database/media archive was uploaded privately to Google Drive, downloaded with matching checksum, and restored into an isolated temporary database with record and index verification. Five Cloudinary originals were verified; the legacy MongoDB photo is preserved in the database snapshot.

## Demonstration sequence

1. Show masked staff member lists and enabled MFA status without exposing setup keys or recovery codes.
2. Show the stored cooldown screenshot rather than trying wrong passwords on a real account.
3. Describe the disposable signup, one-use email code and mutual matching results; no test accounts are left active for reuse.
4. Show backup success records with counts/checksums, never the encryption key or decrypted data.
5. Show Render health and the independent public GitHub health workflow.

## Operational limits

Daily backups and transition email alerts still require this computer, Codex, credentials, provider access and the database network allowlist to remain available. Independent GitHub health checks can be delayed and do not establish email-alert delivery. No backup retention deletion has been enabled. Key recovery custody remains the owner's responsibility. The existing seeded demonstration dataset remains in production by prior request.

The database archive is not a transactional point-in-time snapshot. Photo archival does not automatically overwrite current Cloudinary assets during recovery. A real incident requires a reviewed restore plan. Read-only staff page checks do not exercise moderation decisions against real members. These results support this bounded acceptance scope; they do not establish that the application has no vulnerabilities.
