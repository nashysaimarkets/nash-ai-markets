# Native/source/design acceptance plan — 11 October 2026

RELEASE HOLD. This is an executable test plan, not acceptance evidence. No purchase, paid scanner request, production migration or store submission is authorised by this document. Resolve final PR #112 SHA, exact preview and exclusive writer ownership before each continuation.

| Gate | Genuine test | Evidence required / present limitation |
|---|---|---|
| Native build | Pin CAPACITOR_SERVER_URL to the immutable final `/pocket` deployment and CAPACITOR_SERVER_REVISION to its exact SHA; run verify-capacitor-server before sync and signed build | Build-manifest must match. Xcode/Swift compiler, signing and physical iPhone unavailable in this workspace; no compile/sign proof claimed |
| Apple configuration | Validate official Apple roots, existing bundle/app/product, In-App Purchase key and explicit sandbox environment in isolated staging/preview | Server-only settings; do not modify live keys or accept sandbox in production. No settings configured by this checkpoint |
| Identity | Verified login in real native WKWebView; logout/account switch; anonymous and unconfirmed account attempts | Recorded real statuses, zero dispatched scans when unauthorized. UUID comes from server auth, never client metadata |
| New purchase | In an independently authorised Apple sandbox test, buy unchanged monthly product with account token; cancel/pending/retry/relaunch | Signed StoreKit proof, current signed Apple status, identity binding and server scan access. No paid purchase executed; test must wait for separate applicable purchase authorization |
| Restoration | Real sandbox purchase restored after app reinstall; restore on another Pocket account; return while offline; refunded/expired/upgraded/grace states | Correct user permitted; cross-user/replayed revoked receipts denied; valid grace expiry verified. Never infer success from client entitled=true |
| Legacy ownership | Identify existing legitimate pre-binding Apple customers and prove ownership before linking | No automatic reassignment, no guessed email, no unverified receipt migration. Current legacy transactions without appAccountToken fail closed |
| First-free | Implement durable server consumption with explicit native eligibility and retry/cancellation semantics; race multiple devices/preflight/analysis requests | One allowed experience cannot become repeated billed preflight or arbitrary free scanner routes. Keychain/localStorage flags grant nothing. Source implementation remains OPEN |
| Real chart flow | iPhone portrait/landscape upload, image replacement during file decode/preflight/crop/scan, switch among five charts, cancel, timeout, recovery | Actual device recording and measured timings. Intercepted Chromium remains preparation only |
| Original Levels | Independently label original visible price ticks; verify original pixels and overlays; axes at image edges, watchlist, JPEG, reversed/log/ambiguous scale | 3 price agreements, 20% coverage, <=1.5 original-pixel residual, no extrapolation; hide/show and chart replacement. Deterministic tests alone do not measure semantic TP/FP/FN |
| Patterns/Liquidity | Reconcile PR #95 source candle endpoints and full negative/witness contracts with candidate; run original chart and six labelled live cases | Still OPEN. Do not draw unqualified model/device geometry or call empty output a correctness pass |
| Redesign | Verify `/pocket-next` guarded upload/confirmed-axis/analysis/cancel flow, all scanners and optional options/crypto tools, mobile scrolling/focus/accessibility | Preview only. Complete parity and genuine native acceptance before changing the single customer entrypoint |
| Spend/accuracy | Reconcile attributed historical request dollars, pending/retry charges and remaining cumulative $2; obtain separate exact expenditure approval | HOLD. No live six-case calls now; preserve null/unmeasured TP/FP/FN, precision/recall and latency |
| Existing Stripe subscribers | Authoritative backfill, isolated sandbox configuration and real verified account/customer-return/webhook tests | Existing independent web entitlement guard preserved; source integration is not rollout proof |

When external resources become available, execute the above against one frozen exact SHA. Save redacted transaction/status/build/device receipts with IDs and timestamps, record real provider latency and ledger settlement, and update the master register only for gates actually proven. Never publish raw signed transactions, user tokens, private keys or customer screenshots in PR comments.

Free restart commands: `npm run test:unit`, `npm run typecheck`, `npm run lint`, `npm run test:render`, `npm run simulate:production`, `npm run ops:validate`, `npm run security:scan`, `npm run build`, `npm run test:rendered`. Existing `scripts/verify-pocket-mobile-free.mjs` intercepts billed browser routes and records providerCalls=0; its outputs must remain labelled mock preparation.

## Durable-access successor acceptance additions

Record exact Git SHA, immutable preview/build manifest, native build number, device/iOS, environment and redacted independent evidence per case. Never put signed proofs, secrets or personal receipts into artifacts. All cases below remain NOT RUN on a genuine device.

| Case | Required result | Evidence |
| --- | --- | --- |
| First-free cold start, reinstall, account deletion/recreation | No client flag/reset can replenish same verified identity | Redacted ledger transitions + screen capture |
| Parallel preflight/analysis and exact retry | One accepted phase, busy/replay response, no duplicate paid dispatch | Concurrent server requests + provider receipt reconciliation |
| Cancellation before vs after admission | Release only before durable claim; no replenishment after claim | Time-aligned request/ledger/provider receipts |
| Third preflight, fourth attempt, wrong context/image, changed payload | Retake cap and exact-image prerequisite enforced | Redacted requests/status + ledger |
| Purchase completion before entitlement stream catches up | Immediate signed proof reaches server; UI grants only after verification | Sandbox native/server timeline |
| Restore and pending/out-of-app update | Current server verification, correct account, stale callbacks ignored | Device event + redacted server verification |
| Missing account token legacy owner / wrong owner | Independently approved mapping accepts only correct environment/user; no possession claim | Mapping evidence reference + account-bound checks |
| Signed renewal/grace/refund/revocation events | Correct product/account current statuses; events idempotent, never grant alone | Apple sandbox signed-event digest + refreshed scan status |
| Original Patterns/Liquidity candles | Independent image endpoints/axis; uncertain or unsupported geometry held | Annotated labelled real corpus with exact source hashes |
| Redesign tool parity | Risk/purchase/options/crypto plus remaining workflows accepted without bypass | Device workflow matrix and security responses |

## 12 October source/UX successor acceptance additions

The guarded redesign candidate now provides follow-up, shared device decision history/save/delete, before/after process review, user-defined plan/export, official macro/calendar availability, explicit symbol-matched company lookup and standalone Level Lab. Free Chromium tests use intercepted endpoints and real IndexedDB/file downloads/Canvas; they do not verify Apple, provider semantics, real company-event availability or physical iPhone behaviour. `/pocket` remains the customer/native entrypoint; `/pocket-next` remains a preview.

On a separately authorised physical-iPhone/sandbox test candidate:
1. Pin the native wrapper to the immutable HTTPS candidate and exact full SHA; verify deployed manifest and native revision check. Never use a mutable branch alias or production URL for acceptance.
2. Verify registration/confirmed identity; first-free policy remains OFF until retention, cleanup health, staging acceptance and a production migration/configuration window are independently approved. Test retries/cancel/retake limits without replenishing an admitted call.
3. Test fresh purchase, immediate signed JWS delivery, subscription update, restore after reinstall, independent legacy ownership mapping, cross-account denial, expiry/refund/grace and signed notification identity/idempotence in isolated Apple sandbox. Never treat a local StoreKit boolean as server entitlement. Real Stripe backfill and signed webhooks remain separate before rollout.
4. Exercise the candidate tools on real source images: save a decision, restart app, reload history; select the correct saved before image; add/redact after chart; cancel/reselect during a delayed review; verify no stale result. Check valid LONG/SHORT user-defined prices and invalid side/order; export/share actual text on iOS; delete the saved decision. Confirm five uploaded chart slots never borrow another chart's report.
5. For Level Lab, confirm its own source and axes, replace it during crop/request, cancel/retry and verify the main report/image are unchanged. The endpoint now reports its own instrument/timeframe/readability contract. Require exact agreement with that image’s locked facts and independent original-pixel OCR/grid checks before drawing; mismatches, unknown identity or missing fields must hold placement.
6. Test official event freshness, London timezone/daylight-saving times, missing/unavailable schedule messaging and symbol-matched company events; macro-only index charts must never receive a company ticker feed.
7. Once budget history and reservations are reconciled and exact spending separately authorised, run each labelled scanner case individually. Preserve request/response identity, full source/crop pixels and actual output, TP/FP/FN, precision/recall/latency per scanner. Preserve local application rate-limit marker and retry/reset headers; a 429/network failure is unmeasured, not a model miss. Require independent real Liquidity interval endpoints and every supplied original-candle witness; zero-width bands remain lines.

No physical-device, sandbox purchase, native Swift compilation or labelled live-scanner result was produced by these additions. RELEASE HOLD remains.
