# PostDate security demonstration

Prepared from the October 20, 2026 acceptance checks. Allow approximately six minutes.

## Before presenting

Open the Render-hosted site, this guide, SECURITY_ACCEPTANCE_2026-10-20.md, and the stored cooldown screenshot at backend/.cache/login-cooldown-proof.png. Sign in with your staff account and complete MFA privately before sharing your screen. Close terminals, environment files, email codes, setup keys and password-manager windows. Use the overview and summary counts when presenting; member messages and report descriptions may be private.

## Presentation script

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:40 | PostDate landing page | “PostDate is a community dating platform. This demonstration focuses on account protection, access control, input validation and recovery.” |
| 0:40–1:25 | Profile → Settings → Authenticator security | “Staff accounts use an authenticator as a second factor. This account reports MFA enabled. Password recovery does not remove that factor.” Show only the enabled status; keep secrets and recovery codes closed. |
| 1:25–2:05 | Stored login-cooldown screenshot | “Five incorrect passwords for the same normalized email exhaust the failure budget. The next request is temporarily limited, with a retry time. MongoDB stores the counters, and parallel requests cannot bypass the budget.” The remaining fixed window can be shorter than fifteen minutes. |
| 2:05–2:45 | Staff overview; describe access-check results | “Member accounts were denied the staff API in controlled tests. This staff account was redirected away from the admin-only page. Member emails are masked in staff lists.” Keep moderation controls untouched. |
| 2:45–3:25 | Acceptance report, validation section | “Validation runs on the server as well as in forms. Malformed numeric filters, duplicate query values and out-of-range values were rejected. Authenticator enrollment takes six digits; recovery codes retain their required letters.” |
| 3:25–4:20 | Acceptance report, signup and matching results | “A disposable signup could not log in before email verification. Its delivered code worked once, and reuse failed. Two disposable members created one match through mutual likes; retry did not duplicate it. Messaging, blocking and report isolation also passed.” Explain that the test accounts were removed, so these results are recorded evidence rather than reusable demo logins. |
| 4:20–5:10 | Backup summary from the acceptance report | “The encrypted database and photo archive was stored privately off-host. We downloaded it, checked its checksum and restored the database into an isolated temporary instance. The original drill covered nineteen collections and 514 documents; later backups can have different counts.” Never open decrypted contents or the encryption key. |
| 5:10–6:00 | Render dashboard and GitHub Actions health history | “The application runs on Render. Independent public checks also run through GitHub. Daily backups and transition email alerts currently run through the desktop, so they depend on this computer and app being available. Always-on hosting remains the next operational improvement.” |

## Questions you may be asked

**Is the system completely secure?**

“The documented controls passed bounded regression and live acceptance checks. That provides evidence for the tested behavior, not a guarantee against every vulnerability. Continued monitoring, dependency maintenance and recovery drills are still necessary.”

**Why use both MFA and rate limiting?**

“Rate limiting reduces repeated online password guessing. MFA adds a separate factor if a password is compromised. They protect different parts of the login flow.”

**What if the backup key is lost?**

“The encrypted backups cannot be decrypted without it. The owner must retain a separate recovery copy in a password manager.”

**Does the backup automatically restore everything?**

“The archive preserves database records and referenced photo bytes. Database restoration was tested in isolation. Restoring historical images to the live provider requires a reviewed recovery procedure to avoid overwriting current content.”

**Are dashboard figures real research results?**

“Production includes a deliberately seeded demonstration dataset, identified as demo accounts. Those figures must be distinguished from survey responses and real usage.”

## Owner follow-through

- Save the existing BACKUP_ENCRYPTION_KEY from ignored backend/.env.backup in your private password manager. Do not generate a replacement for existing archives. Keep the key outside the backup folder and repository.
- Keep the computer and Codex available for the scheduled daily backup and transition email monitor. Review failures when notified.
- For always-on operation, choose a runner and private storage authentication method, then move only the minimum required secrets through secure configuration. The connected Drive tool does not itself grant an unattended server credential. No paid service has been approved or provisioned.

Reference: SECURITY_ACCEPTANCE_2026-10-20.md contains the acceptance results and limits; OPERATIONS.md contains operator procedures.
