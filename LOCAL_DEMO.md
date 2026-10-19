# Local dashboard demo

Start local MongoDB, then run from the project folder:

```powershell
node backend/scripts/localDemo.js
```

Open http://localhost:5001/admin. The local demo administrator email and generated password are in `backend/.env.demo`. This file is ignored by Git; do not publish it or use these credentials in production.

The launcher uses only `mongodb://127.0.0.1:27017/postdate_demo`, binds to loopback, disables email/push delivery and serves the compiled frontend on port 5001. It never replaces `backend/.env` or uses its database URI. The existing hosted site continues to use its production database.

The dataset contains 64 member accounts, 2 moderators, 110 total matches, 138 ratings (3 hidden), 28 reports and 5 appeals. It also includes 6 suspended members and 31 sample audit entries. Counts for active/verified members, active matches or pending reports are subsets, so some dashboard cards will show smaller values. Sample profiles are hidden from discovery. Sample member/moderator passwords are random and discarded; these records cannot be used for login.

Rerunning the launcher preserves the dataset and administrator credentials. It verifies expected counts and refuses to modify a demo database containing non-demo accounts. To prepare data without starting the web server, add `--seed-only`. No automatic deletion or production cleanup is performed.

To refresh the compiled frontend after UI edits, run `npm run build --prefix frontend` before starting the demo.

## Explicit hosted demo seeding

An operator can temporarily set `SEED_DEMO_DATA=true` on the existing hosted service and deploy this revision. Startup seeds only when no previous demo run or demo accounts exist. A database marker records completion and the created user IDs; later starts skip completed runs. Failed/partial runs require manual review and are never reset automatically. Set `SEED_DEMO_DATA=false` after the verified run. Existing real records remain, so hosted totals include both existing and sample data. No local demo administrator is created on the hosted site.
