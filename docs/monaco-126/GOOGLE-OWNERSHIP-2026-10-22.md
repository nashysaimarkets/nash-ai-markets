# Google purchase ownership — isolated implementation

Continuation of PR143 at 2a00ef0c860010ca94593a6cfb5f95c335d4dcc9; master Issue126.
No live installation, route, purchase, acknowledgement or entitlement activation.

## Implemented

`database/google/20261022-proposed-token-ownership.sql` adds a private, RLS-enabled token index and a single atomic server-only claim function. Global token uniqueness is independent of account/product/plan. An existing token cannot move between accounts, packages or environments. Replacement inserts the new token and retires the previous token in the same transaction. Immutable identity/parent fields, retirement and revocation tombstones cannot be reset through ordinary DML.

Absent rows are protected by deterministically ordered transaction advisory locks, followed by authoritative row rechecks. Duplicate same-owner claims are idempotent; competing owners or successor tokens cannot both win. Unknown linked ownership is a HOLD, never a fabricated new owner. SQL stores only token hashes, account UUIDs and non-secret scope/history; no raw purchase/OAuth tokens or Google responses.

`createVerifiedGoogleOwnershipRecorder` composes the unchanged Google verifier with the same snapshotted server configuration. Only the purchase token and optional cancellation signal come from the request. The low-level factory is an injection seam for trusted services/tests, not an API that accepts client-provided verification. Before the write it rechecks the authenticated account, freshness and expiry. The SQL statement is fixed and parameterized. A lost/malformed write acknowledgement is UNCERTAIN with reconciliation required; there is no automatic write retry. A confirmed commit followed by cancellation remains recorded, not falsely rolled back. Every response is `entitled:false`.

## Verification boundaries

15 local Node22.16 boundary checks pass. Four additional actual-verifier composition checks and 15 real PostgreSQL tests are prepared for exact-source CI; the final Issue126 receipt records their actual result. PostgreSQL tests include three demonstrably overlapping two-session races, connection-loss rollback, atomic rollback on forced retirement failure, limited-role ACLs and history tampering. No simulated test is represented as provider or hosted-customer acceptance. The original 35 verifier tests are reused by source hash, not repeated or counted again.

The database harness refuses to run without explicit disposable-CI flags and fixes every connection to localhost and a newly created QA database. No live database tools are used. Only the new ownership CI is intentionally triggered; existing repository PR workflows may still auto-run and are not accuracy evidence.

## Remaining integration

This SQL is outside migration discovery. An installation must select the intended database and a dedicated trusted server executor, apply compatibility/rollback review, and explicitly grant only schema usage and execution of the claim function. The proposal deliberately grants no runtime access. Use an autocommit database port whose promise resolves after the statement commits, with bounded connection/statement/lock timeouts. Every future revocation/reconciliation writer must share the same `pocket-google:` token-lock convention and preserve tombstones.

Connect authoritative index reads and trusted account/OAuth/Play configuration; then implement acknowledgement/recovery, authenticated Google notifications/voided reconciliation and per-scanner admission. Ownership alone must not unlock scans. Preserve PR129's purchase lockout until those paths and signed-device/Google tests pass. Current iOS/customer access and pricing are unchanged.

The scanner path is separate: PR142/run39680394456 still requires coordinated owner review and bounded ledger authentication. Both stored secrets are complete; do not recreate, copy or reset them. Do not release the queued job against a NOLOGIN role, and do not leave LOGIN enabled while waiting. Restore and verify NOLOGIN after any controlled attempt. All scheduled Work stays off.

Primary contract references:
- https://developer.android.com/google/play/billing/security
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2
- https://developers.google.com/chromeos/app-development/publish/play-billing-backend

Review: author adversarial review and scoped tests only; no independent reviewer or real-device acceptance claimed.
