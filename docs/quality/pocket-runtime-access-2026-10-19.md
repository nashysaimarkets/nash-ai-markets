# Monaco runtime verification checkpoint

## Intended benchmark identity

The reviewed implementation is commit `93f3fe282c6cab0196812aec989dddaa915bb986` in PR #125. Its existing CI, typecheck, 24 metadata tests, SQL/permissions/immutable aggregate $5 cap/rollback and three real concurrent-session races passed; do not repeat them for this configuration-only follow-up.

| Binding | Required value |
| --- | --- |
| OpenAI organisation | `org-5vLRRzXwcigUx96TVE0rI3RW` (Personal) |
| OpenAI project | `proj_LTmAIE2Ve7gUAFJ9M74ZxIBI` (bullseye private pilot) |
| Existing key tracking ID | `key_EjND5GXtuqF2K0hp` (pocket bullseye staging) |
| Main and annotation snapshot | `gpt-5-mini-2025-08-07` |
| Service tier | `default` |
| Supabase | `pxlqvaddvghjjhenqmdh` |

The existing authenticated OpenAI administrator UI was read without changing settings or creating/revealing keys. It confirms this project, Standard/default tier, and the active, non-expiring key created 18 August 2026, owned by `user-DlYoRdGCCPjv7Bk5iEjduePV`. The second chart-reader key is revoked. This administrator inventory verifies intended ownership; it does **not** prove that the concealed Sites runtime key is the same key. A model-access GET from the actual intended executor remains required. Published pricing and full-reservation evidence from PR #125 remain unchanged; inventory/model access are not request-cost settlement evidence.

## Isolated configuration repair

Run `bash scripts/verify-pocket-benchmark-isolated.sh --metadata-only` only in the authorised isolated executor where the intended existing credentials already reside. It supplies the reviewed project, candidate, backend and both exact model overrides to one child process. It forces both paid dispatch holds off even if inherited settings say true. It invokes the unchanged GET-only verifier; credentials are neither read by the wrapper nor written, printed, copied from Sites or replaced. No arguments or any additional option fails closed. The original API-origin rejection remains intact.

This configuration resolves the main/annotation mismatch without changing Sites environment revision 34, deploying code, enabling a pilot or asserting a live binding. It deliberately pins the tested implementation SHA rather than the later configuration/documentation commit. Four new offline checks verify model/project pinning and forced paid holds, argument rejection, preservation of the API-origin guard, and the actual verifier's credential-access failure before any network activity. Existing CI was not repeated.

## Shared database impact

Sites project `appgprj_6a6efa569218819185b3eefd3c508e66`, version 179, source `0632634a303c5a43b81aab6e75c6e5d44d9dec0e` serves `https://pocket.nashaimarkets.com`. The existing local source checkout was independently matched to that exact saved-version SHA and project manifest; no source credential was minted. Its runtime configuration points to `pxlqvaddvghjjhenqmdh`. **This staging-labelled database is used by the live application, so its label is not an isolation guarantee.** Live main/annotation overrides remain `gpt-5.6-sol` / `gpt-5.6-terra`.

A read-only catalog inspection found no proposed benchmark tables or functions. The reviewed migration creates six benchmark-only private tables and 25 distinct table/function names. Exact live-source scanning found zero references to those names; foreign keys stay within the new benchmark tables. There are no top-level DROP/TRUNCATE/DELETE statements, no changes to live auth/subscriptions/scanner tables, and no seeds enabling paid use. Existing `pocket_test_spend_*` histories remain separate. Migration grants only named benchmark privileges (plus schema usage to service_role, which the read-only catalog check confirms it already has), rather than altering application default privileges.

Additive DDL still acts on the shared database: PostgREST DDL event triggers can refresh the live schema cache, schema locks can briefly contend, and a future live deployment could call the new service-role RPCs. Therefore an eventual installation must use an atomic transaction with short lock/statement timeouts, recheck name collisions, insert no approval/config/enabled rows, verify exact grants and disabled holds, and preserve ledger history on operational rollback. The passed transactional staging tests are reused; no persistent database change occurred here.

The exact live source's existing `/api/openai/health` GET calls `responses.create`; it is a billed inference probe, not a permitted route for this verification. It was inspected but not called. Sites supplies no non-deploying command execution or read-only metadata endpoint, and its runtime key is concealed. No admin API key is configured there. No production credential was exported and no deployment was used to add an endpoint.

## Single missing access capability

**An authorised, non-deploying isolated execution context that already holds the intended project key and existing read-only administrator metadata access, in which the GET-only verifier can run in place.** Browser administrator inventory is available and verified; browser sign-in does not delegate an admin API credential to this process. No new key, copied production secret, renewed approval or paid request is a substitute. Until this execution capability is available, live key/project/model binding cannot pass and the conditional staging installation stays withheld. Financial release also continues to require independently attributed actual charges; no estimated reservation is marked settled.
