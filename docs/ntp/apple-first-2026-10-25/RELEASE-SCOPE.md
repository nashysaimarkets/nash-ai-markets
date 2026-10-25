# Apple-first release: broker integration deferred

Owner amendment25October2026, Issue126/6396823075. Parent14e897ac83b9b9520dde9968b575ac03490effaf; same isolated candidate branch. The owner explicitly prioritises finishing the app and updating the existing Apple App Store app without IG integration. Do not carry IG as a release blocker or substitute another broker.

## In scope

Existing premium five-chart screenshot workspace, repaired scanner workflow, explicit HOLD/UNVERIFIED evidence presentation, cancellation/replacement/recovery, current account and Apple subscription restoration, exact-source backend acceptance, signed iPhone build/testing, store metadata and submission. Retain existing App Store ID6806004581, bundlecom.nashaimarkets.pocketbullseye, monthly productcom.nashaimarkets.pocketbullseye.monthly and current prices. No repeat purchase to establish an existing subscription. Candidate display branding is unchanged by this amendment; public-name decision/clearance is not inferred.

## Deferred, not failed release prerequisites

IG or other broker connection, DEMO API/key setup, broker credentials/consent/vault/bootstrap activation, account/position panel, broker-specific chart provenance and broker data/display rights. The previous blocked broker source-write is not retried or bypassed. Android launch is not a dependency of the Apple-first update. Keep inactive source and existing dormant staging tables intact for later work; no database, login, key or entitlement changes.

## Actual source change

The customer /pocket page no longer imports headers or readPocketIgDemoAvailability, no longer awaits the broker availability branch and no longer supplies broker panel props. It still mounts the same PocketNext component, preserves all CSS/metadata and retains verified-macro fallback. /pocket-next already mounts the component without broker props. No scanner, subscription, provider, model, native-package or premium-layout source is changed. Existing broker component/route tests are retained for the deferred code, not presented as launch dependencies or real broker evidence.

Three dependency-free source/actual-handler tests assert broker decoupling and preserved macro success/failure handling. They replace only JSX construction in the extracted real handler; synthetic macro responses are explicit. Command: node --test tests/apple-first-scope.test.mjs. Node22.16.0 local baseline0pass/3fail, candidate3pass/0fail/0skip. Baseline page blobd26d42b5f95f78d076a0e26d2718494033f0c441 matched the connector bytes; candidate bloba1faf8b5c17aae3bfb22b293841397e8938b4eda. Page SHA256fc25b88e1d537bd7fc402185cba61154bcf0dcde7cbed5c4705083f79e4ef49e; test SHA256bd1f776c102065643170aecca569a0acbcf4bebc04dcc10daf53fcee6d3ae321. Existing integration suite imports these three tests, retaining every existing assertion. Fresh exact-source CI result must be read from the final Issue126 receipt; not claimed by local tests.

## Apple path, without reopening completed investigations

Reuse existing cloud signing history and existing Apple identity; the original Mac is unavailable. Do not repeat previous archive/Apple login searches merely to rediscover this. Prior package searches did not yield a signed candidate; that remains a real gate, not a demand for the old Mac. Current plugin discovery returned no App Store Connect/Codemagic connector. No build/upload/signing connection is claimed from historical setup.

Remaining Apple work is an accepted immutable scanner backend with verified auth/subscription restore and genuine scanner evidence, a signed candidate bound to that backend, actual iPhone acceptance, accurate screenshots/privacy/review information and an authorised Apple submission. Account-holder review of previously flagged Apple agreements remains separate. No legal agreement is accepted on the owner's behalf. The old build47 does not represent this new candidate. Scanner semantic evidence and non-broker commercial/name requirements remain unresolved where previously recorded; removing broker features does not convert synthetic checks to real scanner proof.

Official Apple workflow checked25October2026: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/ and https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/ . Upload/processing, TestFlight acceptance, review submission and public approval/release are separate states. Do not promise an Apple approval date.

## Safeguards and rollback

Keep automatic deployment holds and schedules unchanged; no production/main merge, store change, spending, paid model call, credential access or44held-out use. No live change occurred in this scope patch. Candidate rollback restores only /pocket page from14e897a if needed; do not roll back accepted scanner fixes or staging storage. Latest Issue126 checkpoint governs source identity and writer release.
