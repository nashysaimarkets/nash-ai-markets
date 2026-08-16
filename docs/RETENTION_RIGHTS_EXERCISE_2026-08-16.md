# Staging Retention and Rights Exercise — 16 August 2026

## Outcome

**ISOLATED STAGING DATABASE EXERCISE: PASS. REAL SIGNED-SESSION BROWSER REPLAY: PENDING.**

One synthetic member was created, exported in memory, corrected and deleted in
the isolated Bullseye staging database. No real member or deliverable email
address was used. The exact synthetic identity and exported content are not
recorded in Git.

## Target and exclusions

| Item | Evidence |
|---|---|
| Project | `nashaimarkets-staging` |
| Project reference | `pxlqvaddvghjjhenqmdh` |
| Project state | `ACTIVE_HEALTHY` |
| Database host | `db.pxlqvaddvghjjhenqmdh.supabase.co` |
| Production-linked project | `opmgzchnmcgnsfwpmysc` — identified and excluded |
| Existing staging baseline | 2 Auth users and 5 sessions |
| Synthetic-marker preflight | Zero matching Auth, membership, Founding and Storage rows |
| External systems | No Stripe, email, DNS, Vercel, provider or production action |

No Supabase configuration, secret, authentication setting, RLS policy, schema,
provider integration or market-safety control was changed.

## Exercise evidence

1. Created one non-deliverable synthetic Auth identity and minimum isolated
   records for account profile, inactive Free membership, membership preview,
   member onboarding, Founding onboarding and private trade journal.
2. Confirmed no Founding 100 award, Storage object or synthetic session existed.
3. Built a six-section in-memory export and verified every required section was
   present. Only its SHA-256 evidence was retained:
   `357e5fcfff33d8c54bca2f95233cab812591c09856ce7f9c52d9e7d9e288abad`.
4. Corrected the synthetic profile, onboarding and journal values and re-read
   all three successfully.
5. Applied the approved dependency order: remove any sessions, remove the
   standalone email-keyed membership row, then delete the Auth user. Foreign-key
   cascades removed the preview, onboarding and journal records.
6. Verified zero synthetic rows remained across Auth, sessions, Storage,
   membership, preview, both onboarding tables, journal, ideas/votes/comments
   and Founding awards. The original staging user/session counts were restored
   to exactly 2 Auth users and 5 sessions.
7. Simulated the deleted user's claims under the `authenticated` database role.
   RLS returned zero visible onboarding, journal, membership, preview, Founding
   onboarding, idea, vote and comment rows.

## Application and token boundary

Protected Bullseye pages call server-validated `supabase.auth.getUser()` and
redirect when no current user is returned. Repository authentication and route
guard tests remain the application-side evidence for that fail-closed design.

Supabase documents that deleting a user does not immediately invalidate an
already-issued access-token JWT; it remains cryptographically valid until its
expiry. This exercise deliberately created no deliverable identity or signed
session, so it does **not** claim a physical browser replay with a deleted
user's still-valid token. Complete that final replay only in isolated staging
with a purpose-made session if qualified review or launch acceptance requires
it; never use a customer account.

## Backups and external processors

No logical dump or external export was created during this exercise, so there
is no separate Bullseye-controlled backup copy of the synthetic data to erase.
The approved operating schedule requires deletion to age out through the
rolling backup period. The separate full disposable-restore gate and exact
provider recovery-media retention remain pending.

Support-mail, transactional-email and billing-provider deletion were not
exercised because the synthetic identity was never sent to those systems. Test
those processors separately only after they are configured and their retention
controls are documented.

## References

- [Data retention and rights schedule](DATA_RETENTION_AND_RIGHTS_SCHEDULE.md)
- [Staging restore evidence](RESTORE_EVIDENCE_2026-08-16.md)
- Supabase, [User Management](https://supabase.com/docs/guides/auth/managing-user-data)
- Supabase, [User sessions](https://supabase.com/docs/guides/auth/sessions)
