# Pocket Sites / native compatibility checkpoint — 18 October 2026

Source-only repairs; no deployment, permanent database migration, customer change, price change or provider request.

## Verified boundaries

- Live Sites project `appgprj_6a6efa569218819185b3eefd3c508e66`, version 175, source `49416848eafd34fc9fea6f35714828d163ad6e10`, custom origin `https://pocket.nashaimarkets.com`. It uses staging Supabase `pxlqvaddvghjjhenqmdh`.
- PR120 began at `1380a5ff8c336b6dab6769ed2dedc7c1960ef90f`. It is a separate source revision; a GitHub change does not change the live Sites worker.
- Documented iPhone Build 47 has a separate immutable Vercel target and production Supabase. Do not change that target or substitute the Sites DB for native.
- Restored founding status is a marketing price lock, separate from UUID-bound scanner access. Do not replay its production restoration.

## Source repairs

Pocket origin and `/pocket` destinations are now allowlisted by exact origin/path boundaries. Dedicated `/pocket/login` uses existing-account-only email authentication, preserves the scanner destination and resumes verified sessions. Generic `/login` on the Pocket host routes to this page. Native controls and Pocket checkout link to Pocket sign-in rather than the general membership page.

`GET /api/pocket/subscription-access` reads the verified server account and the same paid UUID-bound entitlement check as scanner admission. It returns private/no-store Boolean status, no customer identifiers and no provider traffic. First-free and benchmark contexts cannot assert paid status. Web UI distinguishes denial from verification outage and discourages purchasing again when existing access is missing. Independent verified signed Apple access may succeed during an unavailable web ledger; web outages cannot grant first-free use.

The not-yet-installed identity migration retains old named-argument webhook RPC signatures, so source rollback does not produce missing-function failures. Legacy email lookups explicitly return false. Old producers may renew an already bound exact subscription/customer, but never choose a UUID from email. Unbound historical writes remain unbound. Both producer versions and explicit linking serialize subscription changes with an advisory transaction lock. Existing monotonic event and strict customer guards remain. Banned identities cannot be linked.

Quality CI now responds to the actual candidate branch/base and checks out the explicit PR head instead of a synthetic merge. No temporary main-target PR is required.

## Database transition and rollback

1. Confirm migration tracking and absence of the identity schema in the target immediately before installation. Staging catalog checked here: identities absent, legacy RPCs present, neither queried migration version registered. That does not authorize production migration or prove the complete migration ledger.
2. Review/apply the exact migration plus fixture in a disposable transaction first. This session executed that on staging with statement/lock timeouts, then ROLLBACK; identity table remained absent. Tests exercised old/new producer compatibility, exact customer conflict, UUID isolation, same-email recreation denial, revocation, stale/equal-time events, legacy linking and role grants.
3. Obtain authorized maintenance acceptance before persistent schema installation on the live Sites database. Freeze the source tree, matching build-time public Supabase config, server config and migration blob. Install schema before guarded source, with a controlled acceptance window: legacy email access fails closed as soon as schema is installed. Compatibility preserves event ingestion, not email-based scanner permission. No zero-downtime paid-access claim is made.
4. Bind ONLY after a genuine Pocket session proves its application UUID and independent exact active Stripe customer/subscription evidence proves ownership in that same DB. The known production founder UUID and staging UUID differ; email equality cannot select one. Do not auto-copy customer records across projects or backfill by email.
5. Test signed login, active/expired/recreated-account status, webhook renewal/cancellation/replay and anonymous denial on the exact saved Sites revision in a disposable/private acceptance environment. Never run the old live analyser publicly merely to bypass new guards.
6. Release requires an explicit approval for the exact Sites version/schema transition. Preserve the current public audience and DNS. No public version was created by this session.
7. On source failure, stop paid scanner admission and roll back to a reviewed compatible source, preserving durable UUID/customer bindings, monotonic timestamps and provider ledger. Legacy email lookup remains deny-only. Reverting to v175 also restores its missing scanner guard and false client entitlement; it is NOT an accepted security rollback. Do not drop identity tables or replay founding restoration. Document a known-safe fail-closed rollback artifact before approval.

## Real scanner and native gates

`pocket-real-corpus-recovery-2026-10-18.json` records the recovered six original/reference pairs and verified original image hashes. Do not commit/distribute the provisional source images. Existing pack includes annotations/offline scorer, but upstream rights/feed identity and second annotation review remain unresolved. Synthetic runner internally creates synthetic images and cannot be relabelled as a real-image adapter. Genuine provider cases executed here: 0/6; TP/FP/FN, precision/recall and provider latency are unmeasured, not zero or 100%.

The $5 controls remain unchanged. Actual provider project/model, maximum cost and independent billing reconciliation are prerequisites to any paid case; none were run.

No physical iPhone or signed Apple resources are exposed in this Linux session. Signed StoreKit purchase, restore, renewal, cancellation and real five-chart upload remain device/Apple acceptance work. Existing mocked tests are not that evidence. No Apple publication or native pin change.
