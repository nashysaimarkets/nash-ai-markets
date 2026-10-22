# L12: Google purchase verifier — implemented, unmounted

Parent: PR142 at42684f0e3fba56964275d8ae939f550b7216a54c. Separate branch; PR129's purchase lockout stays intact. This is the missing verification component identified in PR129, not completed Android billing or a release.

`createGoogleSubscriptionVerifier(config, ports)` accepts server configuration and read-only services for authenticated Pocket account mapping, global token ownership, existing OAuth access and HTTP. Its `verify` input accepts only a purchase token and cancellation signal. It sends at most one fixed Google subscriptionsv2 GET, with no redirects, cookies, retry, acknowledgement or purchase. Response size and the complete operation are bounded.

The component checks exact obfuscated account mapping, product/base plan, lifecycle state, expiry, sandbox separation, existing/replaced/revoked token ownership, linked-token ownership and a second account check. Unknown or ambiguous state fails closed. Public refusals contain fixed codes, never raw provider errors, bearer/purchase tokens or source bodies.

A successful result is **VERIFIED_FOR_PERSISTENCE**, always **entitled:false**. The integrating backend must atomically recheck unique token ownership, bind the account, retire linked tokens, preserve encrypted tokens for later provider refresh, complete acknowledgement/recovery and process authenticated notifications/voided purchases before granting scanner admission. Missing legacy mappings require review rather than email-based reassignment. Actual Play package/base-plan configuration and OAuth resources must be verified, not invented.

35 new offline tests pass on Node22.16.0; no earlier suites rerun. Exact source hashes and compressed raw log are in `qa/google-subscription-verifier/`. The new CI runs only this suite on Node24.19.0 with no runtime secrets or deployment. Real Google, signed-device, store and atomic-database acceptance remain untested.

No live customer state, prices, native purchase controls, scanner credentials or schedules changed. Existing scanner auth run39680394456 is separate and still needs coordinated owner approval and temporary database login.

Primary contracts consulted21October2026:
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2
- https://developer.android.com/google/play/billing/security
