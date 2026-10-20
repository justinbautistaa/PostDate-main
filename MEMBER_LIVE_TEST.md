# Live member check — October 19, 2026

Tested a user-provided signed-in member session on https://postdate.onrender.com.

Passed: dashboard and existing avatar loading; profile sections; editor opening/cancel; gallery controls; MFA/privacy/blocked-people settings loading; discovery filters and no-result search; existing chat history and disabled empty-message send; own-reports empty state; member exclusion from the admin page; session still usable afterward.

Responsive check: at 390 by 844, dashboard and discovery did not overflow horizontally. The viewport was restored afterward. This was a limited visual and semantic-label check, not a complete accessibility audit.

Finding: one discovery card displays Photo unavailable. The photo component uses this text when an image URL fails to load. The underlying storage/reference/authorization cause is not established. Do not treat this as confirmed missing user content or change photo permissions without diagnosis.

Not exercised on real users: new likes/matches, sending chat messages, blocking/unmatching, submitting reports, uploads/deletions, MFA enrollment/reset, password reset and account deletion. These actions need disposable test data or specific user participation. Viewing a conversation may mark received messages as read through normal app behavior.

No profile content, privacy choice, password or authenticator was changed. No message or report was submitted. No files were uploaded or deleted.

## Follow-up — October 20, 2026
The affected discovery photo returned 404. A scoped live diagnostic confirmed a valid gallery/avatar reference, but no authenticated or legacy public Cloudinary asset. The exact original WebP existed in local uploads. After explicit user approval, it was restored as an authenticated cloud asset; the signed-in live browser confirmed successful rendering. No privacy check was relaxed. The temporary diagnostic setting was disabled. Bounded photo retries and discovery-modal keyboard focus management were also deployed; 113 frontend tests and the production build passed, plus two diagnostic tests. Image proof is retained in ignored backend/.cache/photo-restored.png.

## Staff browser check — October 20, 2026

Using the owner's signed-in staff session on the Render site, the staff overview, user list, pending reports, appeals, ratings, member follow-ups and community notices all loaded. The user list masked emails. The account's Settings page reported authenticator MFA enabled. Browser warning/error inspection returned no entries at check time. Visiting the admin-only page redirected the staff session to the public home page; returning to /staff succeeded. No moderation action, privacy setting, profile field, password or authenticator was changed.

This checks rendered pages and the resulting role redirect, not an adversarial test of every staff API. The MFA challenge was completed by the owner before inspection and was not directly observed or replay-tested. Public signup/email verification and mutual discovery matching still require a separate controlled acceptance run.
