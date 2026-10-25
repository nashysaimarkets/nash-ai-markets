# Build 53 approved live setup — owner restoration still blocked

Source SHA `4a43c870d5d8378633b9f266394e7c4a822d2e70`, tree `1ad80e150eae29f0493825a8b4d656f53432ccce` on `monaco-build53-runtime-184930`.

User approved the precise Apple key and missing-schema setup. Created one IAP key, Pocket Apple Verification (ID 335S9J4H84), and stored its private key as a sensitive server-only variable on this preview branch. Official Apple CA roots, issuer/app/key IDs and explicit Production environment installed on that branch only. Production app deployment/main/pricing and existing customer rows unchanged.

Applied atomic migration `monaco_approved_apple_runtime_dependencies` from the four hash-pinned SQL files below after absent-object inspection and disposable rehearsal. This changes live database schema only: new private ledgers remain empty. Browser roles cannot execute the entitlement functions; service_role can. Actual service_role unknown-UUID probes return false/false/empty array. Existing unrelated security warning unchanged; four new RLS-no-policy informational notices are intentional service-only tables.

A real read-only Production App Store Server API getNotificationHistory call accepted the key. Sandbox call failed with FetchError: no Sandbox acceptance claimed. Neither call establishes an active subscription or owner restoration.

Candidate deployment `dpl_9vX7MU7GsawPZy16Qes9zmFrnxsM` is READY at https://nash-ai-markets-radei9ycv-nash-ai-markets.vercel.app. Live native-readiness returns HTTP200, exact source SHA, ready=true and all four dependency checks true. Its separate API/owner/device flags remain deliberately false; API credential evidence is recorded separately. Unsigned apple-account, subscription-access, preflight and analyse all return401 POCKET_LOGIN_REQUIRED, with no paid inference or entitlement grant.

Retained offline evidence:101 targeted tests,46 new default-runner tests,85 independent tests,15 disposable SQL checks; typecheck/lint/secret scan/webpack build passed. Counts overlap and must not be summed. No UI changes in this runtime repair; prior20 browser checks are reused, not new live device evidence. Independent setup review accepts dependency setup and agrees to hold native upload.

BLOCKER: no independently verified original transaction mapped to the authenticated app UUID. Limited existing receipt/access evidence did not establish a current Apple entitlement. Do not infer ownership from an email, create a paid entitlement, or ask for repurchase. Need existing Apple order/transaction evidence plus authenticated app identity, then fresh signed Apple status and account/scanner acceptance. TestFlight may send a nonempty Sandbox JWS; it must remain rejected by the Production verifier, not silently discarded to trigger mapped recovery. Record actual native proof presence/environment and complete signed-device testing.

Build53 has NOT been signed or uploaded. Existing internal Build52 remains unchanged. CI pins are not advanced. No main merge or public release. Automatic deployment remains disabled. Preserve the exact tested source when resuming; an evidence-only commit is not a different tested app binary.

## Historical pre-approval checkpoint (superseded by the live state above)

# Build 52 owner failure → isolated Build 53 runtime repair

Base evidence b0b43975206fbc74ab92e55f7d1716318f24fb9e; original Build52 source2091e1ec4307b414df9f7635935f0d10e45ff3e9. Candidate branch monaco-build53-runtime-184930, automatic deployment OFF. No new internal binary/deployment yet.

## Reproduced live blockers
Owner screenshot shows POCKET_APPLE_CONFIGURATION after successful-looking email return, plus analysis unavailable. Read-only Vercel names/targets: all six Apple verifier variables absent. Apple Users and Access → Integrations → In-App Purchase shows Active(0); App Store Connect upload keys are different credentials and cannot verify purchases. Secure Apple admin sign-in was restored; named key form prepared but Generate NOT clicked.

Read-only catalog on opmgzchnmcgnsfwpmysc: no has_pocket_web_subscription or is_pocket_apple_legacy_owner functions, no private entitlement tables. Existing public apple_subscription_events has zero rows; that table is NOT this verifier's entitlement authority. No customer rows were fetched or changed. Error-level logs contained no usable trace, so no claim of a paid-provider failure.

## Source repair
The missing-proof path now reads only independently recorded UUID/environment/original-transaction ownership mappings, rechecks ownership, and verifies fresh signed Apple subscription status. Same path used by account and scan admission. No email/receipt-possession linking, no automatic environment fallback, no repurchase. Expired/revoked/wrong-account/invalid signatures remain denied. A supplied invalid proof cannot fall back to a different server mapping. Explicit Production verification on a preview can recover an evidenced production subscription; Sandbox is never accepted as production.

Proposed service-role-only read RPC returns at most six IDs; runtime rejects more than five rather than truncating ambiguity. Existing mapping tables/ownership verifier reused. SQL proposal is NOT installed, and no mapping exists merely because source supports one.

New bounded/coalesced readiness endpoint is available only on explicitly bound immutable native previews. It bypasses session middleware only on its exact path, does no customer/session reads, and probes nonexistent zero-UUID accounts for false/empty responses. Key/roots are structurally validated. CI now requires exact-SHA runtime configuration/schema readiness before signing. Readiness explicitly returns appleApiAcceptance:false, ownerRestoreAcceptance:false and deviceAcceptance:false: valid-looking configuration is NOT Apple API or owner restoration acceptance.

## Verification
101 targeted Node tests PASS, including negative recovery, grace/refund/expiry, wrong environment/account, malformed ownership IDs, cancellation/timeouts, account/scanner admission, and exact readiness middleware bypass.46 new tests also pass the default Node runner. Independent review85 tests PASS; final offline source accepted. TypeScript, changed-file lint, secret scan and final production Next webpack build PASS with nonfunctional offline config.

15 disposable PGlite0.3.14 SQL checks PASS: actual three existing migrations plus new read RPC install, empty lookup, UUID/environment isolation, revoked mapping, ambiguity bound, browser denial/service execute and service insert denial. All synthetic rows rolled back; no hosted DB calls/writes. This is functional/ACL SQL evidence, not native PostgreSQL concurrency or Apple acceptance. No UI changes; retain prior20 browser checks without counting them as new/live.

## Concrete live setup decision
1. Create one In-App Purchase key named Pocket Apple Verification; store its private p8 only as server-only sensitive POCKET_APPLE_SIGNING_KEY on the owned Vercel preview branch. Never source/log/chat. Store nonsecret key ID, issuer ID, app ID6806004581 and trusted official Apple roots. Select environment from verified existing-purchase evidence; never guess/fallback. No purchase, price, public-release or billing change.
2. Install the four exact SQL files/hash pins in EVIDENCE.json in the existing account database, after confirming their objects are still absent and a single-transaction rollback-safe rehearsal. These create missing private entitlement storage and service-only functions; they do not migrate/change existing memberships/prices/customer records or grant a subscription. This is a change to the live database schema and requires the owner's explicit scope amendment before execution.
3. Establish the owner's UUID/original-transaction mapping only from independently verified existing purchase evidence, then obtain current signed Apple status. No auto-link by email and no invented entitlement. Key creation and schema presence alone are insufficient.
4. Run actual Apple credential/status tests and authenticated account+scanner acceptance; any paid scanner test stays within an explicit bounded budget. No held-out44 cases. Only then deploy/pin/rebuild53 internal-only and request signed-phone acceptance.

Rollback: revoke only the newly created IAP key if needed; remove only owned-preview bindings; retain Build52 and untouched production deployment/main. Do not drop new tables after any real ownership evidence has been stored; disable candidate access instead. No new credential/schema/ownership write has been performed in this checkpoint.
