# IG DEMO storage installed in existing staging — 25 October 2026

## What actually changed

Continues Issue126 claim6395713931 and the existing isolated branch `monaco-ntp-integration-20261025-ad6` from `7c57ac02a3589d41ea990189091b5a214028d8cd`. Owner renewed the launch/integration instruction; no additional spending amount or broker dealing was inferred. Production project `opmgzchnmcgnsfwpmysc`, main, live credentials, stores, prices, schedules and all44held-out charts were excluded.

The real existing `nashaimarkets-staging` project, `pxlqvaddvghjjhenqmdh`, PostgreSQL17.6, now contains the four `ig_demo_private` tables needed by the accepted `ig-demo-postgres.ts` adapter: sessions, credentials, requests and chart_provenance. The restricted `ig_demo_runtime` role exists, but cannot log in, has connection limit0 and no superuser/createdb/createrole/replication/inheritance/RLS-bypass capability. All four tables have enabled AND forced RLS. Browser roles and ordinary service_role have no schema/table access. The managed credentials and provenance tables are read-only to the runtime.

This is an actual staging installation, not another uninstalled proposal. It is NOT an authenticated application connection, vault provisioning, broker connection or launch.

## Reuse and exact installation identity

The installation reuses reviewed proposal `docs/ntp/ig-offline-2026-10-24/UNINSTALLED-storage.sql`, Git blob `b313aca72ac5b5b1ca8ed1e06b31ae05a2f246fa`, and its already accepted adapter shape. Hosted-specific changes are: refuse existing schema/role; explicitly exclude anon/authenticated/service_role from schema and table grants; explicitly restrict every role flag and connection limit; assert role and RLS properties inside the atomic installation. No application source, schema column contract, provider payload, pricing or inference behavior changed. Prior independent offline review is retained; no new independent hosted review is claimed.

Supabase-generated migration versions (not invented local migration names):

- `20261025090527`, `ntp_ig_demo_staging_storage`: one statement,4566UTF-8bytes, SQL SHA256 `bb16a0eef57a8625be04e3420b41fc54804de35b64949a09a260b31373f145a2`.
- `20261025090803`, `ntp_ig_demo_staging_isolation_acceptance`: one statement,10368UTF-8bytes, SQL SHA256 `c7171fb3b5b9da2d27c823916f557eb8bc7f090546ae39bcf91eeabb2504b749`.

Exact original SQL remains in this staging project's migration history. Retrieve ONLY the two named records if needed, and compare their SHA256 before reuse:

```sql
SELECT version,name,statements,
 encode(sha256(convert_to(array_to_string(statements,E'\n'),'UTF8')),'hex') AS sql_sha256
FROM supabase_migrations.schema_migrations
WHERE name IN ('ntp_ig_demo_staging_storage','ntp_ig_demo_staging_isolation_acceptance')
ORDER BY version;
```

Do not reinstall or repeat already passing tests by default. The original proposal's UNINSTALLED label remains historically accurate for that original file; this packet records the separately applied staging variant.

## Actual acceptance and cleanup

The hosted acceptance migration succeeded with29explicit fail-fast checks. Twenty-six checks execute against synthetic fixtures and real PostgreSQL role/RLS behavior; three verify rollback and API exclusions. Test owners and application namespaces are generated at execution, not copied from users. No credential, account, customer chart or provider was involved. This is single-session actual SQL evidence, not a new concurrency or browser-authentication test.

Coverage: restricted runtime identity; absent scope denies reads; correct owner/application reads; cross-owner updates denied; cross-application reads denied; invalid owner/application inserts and ownership reassignment denied; actual adapter-style revocation upsert; stale/current save behavior; expected/stale revocation; late-response rejection; credential/provenance mutation denied; session deletion/truncation denied; application quota visibility and cross-application writes; scoped expiry pruning; invalid epoch and ciphertext-length constraints; trusted-owner switch; ownerless application quota contract; foreign quota preservation; fixture rollback; membership rollback; API-role schema/table exclusion.

PostgreSQL created one automatic admin-only membership from ig_demo_runtime to member postgres, granted by supabase_admin, with INHERIT=false and SET=false. This does NOT mean the runtime inherits postgres privileges. To test the actual runtime, the existing administrative session temporarily received SET permission inside an exception subtransaction. Both that permission and every synthetic row were rolled back before the acceptance migration completed. Failures other than the intentional rollback sentinel propagate and abort acceptance.

A separate fresh query at `2026-10-25T09:08:21.239303+00:00` verified: all four tables empty; NOLOGIN and connection limit0 retained; zero active runtime sessions; original admin-only membership exactly restored; zero accessible non-system tables outside the IG schema; no callable non-system SECURITY DEFINER functions outside the IG schema. No test grant or fake entitlement was left behind. `VERIFY.sql` contains the read-only verification query; `RECEIPT.json` contains the sanitized observations.

One earlier read-only catalog query failed with PostgreSQL0A000 because its UNION used expression ORDER BY. Wrapping the union in a subquery repaired the diagnostic. It made no writes and is not counted as a passing test.

## Security advisor scope

Supabase's security advisor at09:07:23UTC reported no ig_demo_private finding. It also returned21informational RLS-without-policy findings on unrelated existing tables and one existing leaked-password-protection warning. Those are not new IG failures and were not silently changed. This is not a whole-project security clearance. References: [RLS/no-policy advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Remaining executable path

The storage-installation gate is now PASS for this staging project. The approved server runtime still needs a deliberately selected and independently identified restricted database connection, managed encryption key, real authentication/subscription/consent adapters and startup binding. The credential table has zero rows: existing IG DEMO API enablement and secure credential provisioning remain separate from this installation. Do not use a postgres/service_role fallback, LIVE account, screenshot-inferred identity or request-supplied consent to bypass these requirements.

Next engineering should bind the existing accepted runtime to this installed storage, not recreate the schema or another broker bridge. Genuine DEMO account/connect/refresh/disconnect, chart provenance, scanner semantic accuracy, signed native/device, hosting-cost and public-name/commercial-use gates remain unaccepted. Existing134Node/HTTP/SSR+13phone checks and both accepted builds are reused for unchanged application7432574, not claimed as new passes.

## Rollback

No application deployment or production rollback is needed. Candidate repository changes in this checkpoint are evidence only. `ROLLBACK-PROPOSAL.sql` is an unapplied, empty-schema-only rollback for the newly installed staging objects; it must not be executed against production or after credentials/sessions/provenance have been populated. It refuses extra schema objects, login activation and dependent objects rather than using CASCADE. A real rollback should be recorded as a separate reviewed migration, never by deleting migration history.

No API secrets were inspected or created, no new paid infrastructure was provisioned, no model/IG/Google call was made, and no live trading or payment was performed. No background continuation is running. The final Issue126 receipt pins this documentation commit and releases the branch claim.
