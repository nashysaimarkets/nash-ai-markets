# Premium and Android release-candidate integration

Candidate branch: `monaco-premium-android-rc-20261024-baf`. Parent evidence `a3f59ad5e7d7ba0b800ee7fd4da8fdf6db1ea8b3`, executable parent `7f8fdfc0871e0bcc02bb40ec5d95bc4db723bd74`. Exclusive claim Issue126/6390233378; final enclosing Issue126 receipt releases writer.

Executable source `58eb0f51404567c8914549d5efe84c1509935ec1`; tree `916be37f7fff600d386e376efd6795624cf94f02`, byte-identical to local `e450305c562d1984b4931839d3ea5177670d9a1b`. Final documentation commit is supplied by Issue126, not substituted for executable source.

## Implementation

`/pocket` now mounts the existing accepted PocketNext five-chart interface and repaired scanner helpers. Legacy scanner implementation remains in source. No engine/vault/quota/SQL replacement. Optional IG panel stays disabled on the actual route until reviewed server availability/owner/provenance bindings exist.

Android PR129 source `2780f94c18f88b48c7da8a1151d5c109724a8e1c` reused, with small native backend-identity and ephemeral purchase-proof handoff additions. Matching8.5.1 Android dependency/lock record reused. Java purchase method remains hard-disabled. JS checks native-compiled HTTPS origin and exact build revision before reading or sending proof. Proof never enters browser storage; stale caller headers removed; restore bounded/cancellable with no retries. Regular scans retain existing deadlines/body policy. Valid web subscribers are not required to own a Play token.

Mounted authenticated Google-account route and shared scanner-access hook compose with a trusted request-scoped runtime factory. Default503/HOLD cannot be overridden by client headers. Authenticated account must match runtime decision; restore requires same Origin; responses no-store; scanner POST body preserved. Concrete OAuth/database/obfuscation/bootstrap adapters remain unconfigured. New-purchase acknowledgement/reconciliation activation remains gated. Android controls preserve Apple controls/restore behavior and cancel on lifecycle change; premium scanner cancels background work and clears RUNNING badges.

## Verification

- 108 distinct Node/render cases:70 affected boundary/security/integration +38 premium workspace/scanner-claims/IG lifecycle/render,0fail/skip. Reruns and historical overlaps not added.17 Android candidate-boundary cases included in70.
- 18 actual Chromium desktop1440x1000/mobile390x844 component/CSS checks: five image slots, synthetic overlay, UNVERIFIED claims, opt-in synthetic IG account, unknown-provenance HOLD, chart-context clearing, demo return preservation and viewport overflow. HTTP responses controlled; zero broker/inference calls. Same stylesheet stack/order as actual `/pocket`; this is real browser component integration, not deployed authenticated-service/device acceptance.
- Full TypeScript, changed-source lint and secret scan PASS. Local production build PASS; final hosted exact-source build is the authoritative receipt. No deploy.
- Independent reviewer accepted limited offline integration scope, independently matched remote/local tree and reran70/70. See REVIEW.md.
- Prior72 targeted cases and native PostgreSQL17.11 genuine multi-backend isolation/quota/revocation evidence retained at a3f59ad. Database/IG adapters/schema/scanner geometry unchanged; those suites not unnecessarily repeated.

Initial run40138438324 atcbc92ca passed70 tests then failed a browser harness landmark selector; no application failure inferred. Corrected actual aside role and full stylesheet order at58eb0f5. Final run40138586652/job121005294627 supplies independent browser/build/debug results; final result SUCCESS. Chromium155.0.8059.39:18/18,0errors,7 synthetic intercepted API requests,0provider calls. Full TypeScript and production build/ESM artifact validation PASS. Android Gradle assembleDebug BUILD SUCCESSFUL in2m31s with Java21 and synthetic non-routable backend pins; no release-signed package, emulator or physical device acceptance. Full log retained in HOSTED-CI.txt.

## Preview and external gates

Buildable offline premium candidate; no hosted preview/deployment created. Interface demos are explicitly synthetic; real IG panel configuration and Google runtime remain HOLD/unconfigured. Signed iPhone/Play device acceptance is not implied by browser, Node or debug compile. Commercial display/data permissions remain unverified. See EXTERNAL-GATES.md for exact smallest owner/configuration/device steps and remaining engineering. No owner involvement requested while independently executable checks remained.

No LIVE IG, paid API/inference, production DB changes, deployment, main merge, store release, spending or scheduled work. One unsuccessful scoped QA run followed by a corrected public standard-runner job; no paid/larger runners or artifact/cache uploads. Existing signed-package searches not repeated.

Saved logs normalize terminal escape codes and trailing whitespace only; test outcomes and timestamps are preserved.
