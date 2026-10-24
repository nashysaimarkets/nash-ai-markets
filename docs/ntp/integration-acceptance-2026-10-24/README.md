# Integration acceptance preparation — 24 October 2026

Executable source **78c77ae58b8e097a596d10e34d2b6763f0ea7938**, tree **6ba074cd5a2cfb827d4d1a25d470a2f002662628**. Parent **5397b738c7b64d38936bf80c2cb24fee11cebd90** verified at remote monaco-ig-offline-20261024; predecessor explicitly RELEASED. Sole writer integration-acceptance-baf owns only monaco-integration-acceptance-20261024-baf (Issue126 claim6389889115). No prior branches changed. Published source tree is byte-identical to locally tested130548a294cd91852b7d57164c8214cea5a92f4e. Authenticated connector publication used after local git push lacked credentials; no credential creation or export. Publication commit adds evidence only; consult latest Issue126 receipt for exact remote evidence SHA.

Current owner instruction permits disposable database/RLS checks; it supersedes the predecessor's no-database-writes restriction only for isolated tests. No hosted database was selected or contacted.

## Changes and demonstrated results

- Prepared schema now has ENABLE/FORCE RLS on all four private tables. New NOLOGIN/NOBYPASSRLS server role reads credentials/provenance only, maintains owner-scoped sessions and shared application quota rows. Browser roles receive no grants or membership. Adapter sets transaction-local application/canonical owner context; no cross-request setting survives COMMIT/ROLLBACK. Quota intentionally scopes to application, not owner, because every account shares the same provider application allowance. SQL remains **UNINSTALLED** outside migrations.
- Actual embedded PostgreSQL (PGlite) executes this schema and adapter SQL against disposable memory, not fake SQL responses: ciphertext/authentication binding, browser denial, unfiltered cross-owner/application denial, write restrictions, CAS/revocation/stale-save, uppercase UUID normalization, rollback, context clearing, quota exhaustion/window expiry, hashed provenance/expiry and disabled vault. RLS is defense in depth for trusted server code: a malicious runtime credential holder can change custom settings; no claim otherwise.
- Both premium UI mounts accept an optional opaque server-issued reference only for exact owner/context and unexpired shape. Slot replacement/confirmation/owner changes drop it. Server still independently verifies owner/revision/expiry/EPIC/product. No client label creates provenance. Actual issuer/runtime binding remains absent; route stays hard-disabled503/default OFF.
- Reviewer reproduced native cancellation stuck behind unresolved StoreKit getStatus; malformed appAccountToken/entitlement accepted; default redirect could forward signed proof. Fixed bounded cancelable proof wait, strict UUID/boolean, same-origin/error redirects, bounded10s fetch/body and16KiB JSON. Late responses are canceled. Read-only native metadata/listener waits now bounded; timed-out registration invalidates callback generation and cleans late handles. Purchase/restore payment sheets are deliberately not timed out/retried: no ambiguous duplicate purchase. Metadata/account checks fail closed on error.
- Existing shared fixture BigInt literal replaced by equivalent BigInt(1), fixing the demonstrated full ES2017 TypeScript diagnostic without changing semantics.

## Tests — counts are not cumulative historic totals

| Exact-source validation | Result |
|---|---|
| Existing affected IG shared suite + new chart-binding suite | PASS25/25,0skips |
| Actual embedded PostgreSQL acceptance | PASS10/10,0skips |
| Native account boundary + affected request/foreground/subscription/server bridge | PASS62/62,0skips (18 new,44 affected) |
| Actual React IG panel/workspace static renders | PASS7/7,0skips |
| Full repository TypeScript | PASS exit0 |
| Affected production-source ESLint | PASS exit0,0diagnostics |
| Secret-pattern scan and diff check | PASS |
| Independent read-only review | ACCEPTED;31 new checks independently passed |
| Separate simultaneous PostgreSQL backend sessions | BLOCKED: no postgres/initdb server binaries available in this runtime; PGlite does not prove multi-backend lock contention |
| New full production build/browser/native compile | NOT RUN; prior accepted build/browser evidence retained, not represented as current-source acceptance |

**104 executed test cases**,0failures/0skips. Independent reruns are not added. Prior82IG/44native, parent66 affected, original IG transport and other prior scanner evidence remain historical; no double counting. Logs beside this file. Test commands:

```
node --test tests/ig-demo-chart-binding.test.ts tests/ig-demo-shared.test.ts
MONACO_PGLITE_MODULE=<existing-pglite-dist/index.js> node --test tests/integration/ig-demo-storage-acceptance.test.ts
node --test tests/pocket-native-account-boundary.test.ts tests/pocket-native-request-boundary.test.ts tests/pocket-native-subscription-recovery.test.ts tests/pocket-native-foreground-recovery.test.ts tests/pocket-native-server-bridge.test.ts
node --import tsx --test tests/render/ig-demo-workspace.test.ts tests/render/ig-demo-panel.test.ts
./node_modules/.bin/tsc --noEmit --incremental false
```

Database test is outside default unit-test discovery and refuses missing explicit PGlite path; it creates no connection from environment credentials. Original local harness used existing cached PGlite only. No package/lockfile dependency changes or downloads.

## Android evidence reconciled, not repeated

Inspected exact saved source c26b946b18faf6551dfb265ef8b7c5f97da97654 and existing verifier/composition test cases. Original35 verifier checks already cover timeout, noncooperative transport cancellation, malformed/oversized responses, expired/canceled/revoked purchases, wrong account/product and fail-closed entitlement. Ownership CI39732018691 at79ad9edead907f54207f7a97d26f507b16bca0ee records34 unique checks (19Node+15 PostgreSQL including3 overlapping races). These are retained without rerunning unaffected tests. No Android source merged or activated. Runtime acknowledgement/reconciliation/per-scanner admission remains engineering, not a completed external-only gate. Signed Android billing acceptance remains distinct.

## One artifact search and separate external gates

Reused prior unsuccessful Apple/GitHub searches at6e548f1; did not repeat them or Apple login. One additional authorised saved-file metadata search batched .ipa/.xcarchive/.aab/.apk: no matching records surfaced. This does not prove no backup exists; it is not an exhaustive archive-content search. No chart bundles or44heldouts opened.

1. **IG provider acceptance:** owner already confirmed DEMO API is not enabled. Smallest owner action is authorising/enabling DEMO API access in the existing linked IG account (separate approval needed for any new credential). Possible LIVE entitlement is irrelevant. Do not request secret values in chat. Before a genuine request, also approve an isolated runtime and managed vault/key configuration, provider rights and one bounded DEMO read-only session. Existing app remains OFF. No immediate user credential action is needed for this offline checkpoint.
2. **Signed bytes:** one existing backup .ipa/.xcarchive, if available; original Mac not required. If no backup exists, separately authorise an available macOS signing environment with the existing identity and exact candidate runtime pin; no paid environment or new signing identity assumed.
3. **Signed-device acceptance:** after a verified candidate package/runtime exists, owner performs one guided sandbox restore/expiry/cancellation path on a signed device using existing accounts. No repeat paid purchase. Historical build47 Apple metadata is not candidate acceptance.
4. **Apple agreements:** account holder reviews pending agreements before a later update/submission, separately from tests; nothing accepted here.
5. **Storage:** real multi-backend PostgreSQL concurrency/lock-timeout/rollback acceptance still required. Run in disposable local PostgreSQL using the same restricted role and exact schema/adapter; do not substitute hosted production or claim queued PGlite calls prove contention. Managed-key/vault service configuration is also unbound.

Next safe execution: provide a local disposable PostgreSQL server runtime (not a hosted/customer database), then run overlapping revoke/CAS/quota/rollback acceptance. Continue Android acknowledgement/reconciliation/admission work on its isolated source if in scope; retain its35+34 proofs. No new provider requests required for those tasks.

Rollback: discard/revert only this isolated branch. No hosted schema/data rollback needed because nothing installed. SQL role/table creation is transactional; future hosted installation requires its own reviewed role identity, pool bounds, TLS and rollback. No spending, new credentials, IG/LIVE calls, hosted DB/customer writes, deploys, merges, store releases or scheduled work. New branch Vercel automatic deployment disabled; commit messages skip CI and no PR/workflow opened.44heldouts untouched.
