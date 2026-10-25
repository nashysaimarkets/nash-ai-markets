# Build 50 owner-device repairs / conditional Build 51

Source: `917aad9e84387882406efd5b4be89f522ab12ab7`; tree: `88d183e6ae540c0b8c26b3a28df6aba0a227a3f6`. Draft PR #149 targets the existing candidate, never main.

## Completed
- Removed mandatory giant confirmation lock, checkbox and all-fields form. Clear high-confidence chart facts auto-admit. Uncertain printed fields alone can be corrected. Unreadable scale/candles, inadequate history, malformed responses, context mismatch/unknown remain held. Existing scanner pixel/price/source report checks are unchanged.
- Added compact automatic status, explicit retry, and phone-visible demo/account navigation. Five-chart revisions still cancel stale results.
- Reproduced the restore race using the actual action handler: password-sheet lifecycle revision discarded a successful verified response. Repair schedules fresh lifecycle/session verification rather than accepting stale or background results.
- Apple account endpoint reuses authoritative UUID-bound web subscription lookup; Apple verification remains separate. Web entitlement is clearly labelled, not called an Apple purchase. No records linked or modified.
- Bounded error responses now preserve fixed actionable configuration/login/verification/ownership messages. Unknown provider content never reaches the UI. Both client/server accept at most16000-character proof.
- Existing Apple evidence awaiting linking prevents a second purchase in both presentation and direct purchase handler. New subscribers still use a verified server appAccountToken.
- Vercel automatic deployment is disabled for this isolated branch. No native version/pin or publishing change.

## Verification
`node --import tsx --test tests/pocket-build51*.test.ts tests/pocket-*preflight*.test.ts tests/pocket-native*.test.ts tests/pocket-apple*.test.ts tests/pocket-workspace-state.test.ts`:143 PASS,0 FAIL,0 SKIP.

Independent read-only reviewer: exact source tree checked;95 selected tests PASS. Findings fixed: verified web subscriber misleading copy; phone navigation hidden by inherited CSS. No remaining source blockers. This was independent agent review, not App Store/device review.

`node tests/run-build51-browser.mjs`:18 PASS at390x844 and1440x1000, actual React/CSS with intercepted synthetic HTTP;0 real provider calls. Includes auto-admit, single-field correction, unreadable hold, demo/account escape, explicit retry, five sources, replace/cancel late response and no overflow. Compressed actual captures and BROWSER.json are alongside this file. Visually inspected phone capture: automatic status occupies under160px, navigation remains visible.

`node node_modules/typescript/bin/tsc --noEmit --incremental false`:PASS. Changed application-file ESLint:PASS,0 warnings. `git diff --check`:PASS. `node scripts/check-secrets.mjs`:PASS.

`NEXT_PUBLIC_SUPABASE_URL=https://build51-offline.invalid NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_offline_fixture node node_modules/next/dist/bin/next build --webpack`:PASS. Fixture configuration is deliberately nonfunctional and never deployed. Initial local Turbopack attempt rejected the shared dependency symlink; direct webpack is the repository's existing Vercel build command. An unconfigured local build failed onboarding because no local Supabase settings existed; final build uses offline placeholders. Existing middleware deprecation/Edge dependency warnings remain, no new compiler errors.

All executable/test files are exactly tree88d183e6ae540c0b8c26b3a28df6aba0a227a3f6. Local commit edb729b had identical tree; GitHub connector published917aad9 after shell push lacked authentication. No secrets copied to make git push work.

## Genuine acceptance: HOLD
Build50 owner failure remains the latest actual iPhone acceptance. No signed Build51 archive, upload or device success claimed.

Read-only Vercel metadata confirmed Build50 backend f794627 at deployment dpl_2HLtay9qkgdUbjgLkFdDe75A8QnD, target staging. Project environment listing with decrypt=false contains no POCKET_APPLE_* names. Runtime apple-account logs query returned no entries. Therefore actual runtime failure is not conclusively attributed; missing project verifier settings are a concrete configuration gap, not proof of a particular Apple receipt error. No credential values read/exported/created/rotated.

Required verifier settings from existing code: POCKET_APPLE_ENVIRONMENT, POCKET_APPLE_SIGNING_KEY, POCKET_APPLE_KEY_ID, POCKET_APPLE_ISSUER_ID, POCKET_APPLE_ROOT_CERTIFICATES_BASE64, POCKET_APPLE_APP_ID. Candidate environment must match verified Apple evidence; never switch production to Sandbox or silently fall back. Bundle com.nashaimarkets.pocketbullseye; SKU com.nashaimarkets.pocketbullseye.monthly; app6806004581.

Existing owner entitlement on this exact preview/session is UNVERIFIED. Saved Sites web subscription evidence is not evidence for this native backend. A legacy Apple transaction without appAccountToken requires an already verified ownership mapping; possession of receipt/email does not authorize linking. Do not seed customer data or ask owner to buy again.

## Next executable release sequence
1. Verify securely available existing Apple server integration and preview runtime configuration without exposing or creating credentials. Bind only the isolated candidate environment if authorized; no production changes. If no existing integration exists, a separate secure owner setup is needed, not a password/key in chat.
2. Verify existing subscriber session and read-only authoritative entitlement on the exact candidate backend; determine Apple or web source. Keep no-repurchase protection. If legacy Apple mapping is absent, retain HOLD pending verified ownership evidence and separately authorized customer change.
3. After this gate passes, create an immutable candidate preview of the reviewed source, check its SHA and authenticated positive/negative API responses. Preserve current production and old Build50 backend.
4. Only then change existing Codemagic NTP_BUILD to51, bind EXPECTED_NATIVE_REVISION and matching CAPACITOR_SERVER_URL/REVISION, and use the existing signed-export checks. Internal TestFlight only, no external review/public release. No new build system.
5. Owner-device acceptance: existing login, Restore Purchases through Apple password/background return, no charge, automatic chart facts, explicit hold on unreadable chart, five uploads/replace/cancel, free demo/account access. Record real PASS/FAIL separately from the offline tests.

Rollback: discard this isolated branch; original candidate d28a4eb and Build50 native/backend pins were never changed. All held-out cases, prices, customer records, credentials, production and schedules remain untouched.
