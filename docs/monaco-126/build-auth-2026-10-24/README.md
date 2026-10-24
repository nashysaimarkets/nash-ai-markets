# Build and isolated HTTP/auth integration — verified

Published executable source: `30d05357892dc4de4c3e93ce180eeaaf23021c3d`, parent `60f096f0f1451316426d26a264468b5a4505b822`. Exclusive branch `monaco-build-auth-20261024`. The evidence-only commit containing this page preserves that executable source. No production release acceptance is implied.

## Completed

The original reviewed60f096 production Next build passed without an application change. The final repaired source also passed, including full TypeScript. Existing dependencies were reused; package-lock SHA256 exactly matches their source checkout. The cached11Geist/Geist Mono font binaries were copied byte-for-byte into `qa/offline-fonts`, with the official SIL OFL and13asset/CSS integrity pins. Only CSS URL paths changed. `scripts/offline-geist-fonts.cjs` opts into Next's local font response mechanism and rejects unpinned assets, origins and families. Despite the Next environment variable's MOCKED name, font bytes are genuine existing assets, not synthetic replacements. Approved layout/font declarations remain unchanged.

Two independently demonstrated integration defects were repaired:

1. Actual HTTP preflight accepted both malformed `{}` and parseable provider status=incomplete as200. Strict complete/status/shape validation now runs on the server and before browser state accepts facts. READY/LIMITED/RETAKE remain valid; malformed results fall back to explicit manual confirmation rather than inferred lockable facts.
2. Actual HTTP cancellation left the upstream connection running. MAIN, precision, preflight and Level Lab SDK calls now receive the request AbortSignal. Tests verify upstream socket closure, not merely a client AbortError. This stops this application's transport; it cannot guarantee a remote provider refunds or cancels work already performed.

## Actual results

| Check | Result |
|---|---|
| Original60f096 production build | PASS |
| Final30d0535 production build + TypeScript | PASS |
| New preflight unit controls |18/18 PASS|
| Existing affected preflight controls |7/7 PASS|
| Real local HTTP suite |57/57 PASS|
| Changed source lint |0errors,0warnings|
| Production five-chart browser |5/5 PASS|
| Original-image price-row reference comparison |9/9 PASS; max0.49999562784540785px; tolerance1px|
| Browser malformed/incomplete preflight fallback |2/2 PASS; manual confirmation required; no analysis dispatch|
| Independent review |ACCEPTED|

The HTTP suite runs `next start`, actual middleware, SSR cookies, getUser, UUID-bound entitlement RPC and OpenAI SDK over real loopback HTTP. It covers missing/malformed/expired/revoked/unconfirmed/anonymous sessions, unpaid denial, same-email different UUID denial, unavailable/malformed entitlement responses, forged access claims, valid paid access, malformed/incomplete scanner output and cancellation. All denial paths dispatch zero provider requests. Four held upstream sockets closed across three cancellation checks (two MAIN/precision, one Level Lab, one preflight), with no retry/rescue at the observation boundary.

Upstream identity, entitlement and provider services are isolated HTTP fixtures, using dummy strings and retained responses. No hosted GoTrue, RLS, live account entitlement or live provider acceptance is claimed. The app's auth decision functions were not mocked or bypassed. External requests were blocked; no actual database service was activated.

The five-chart browser uses the same session/IP and unchanged four-analysis quota. Scan five initially returns429; after advancing only the isolated Node test clock31minutes, the budget window expires and scan five succeeds. This is not five paid scans in one quota window. d005 remains PRICE CHECK HOLD; the other four yield2/3/2/2 checked rows. Switching and unlocking preserve source binding. Existing acceptance for unrelated lifecycle/scanner safety tests is reused rather than rerun or double-counted. All44heldouts remain untouched; no semantic/trading success is inferred from geometry.

## Recovery and next release gate

Use `SOURCE-BUILD.json`, `FINAL-REVIEW.json`, build logs and HTTP/browser receipts. For offline font loading, set `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` to the absolute path of `scripts/offline-geist-fonts.cjs`; no source/design change is required. The retained harness uses private first-six response/chart paths from this workspace; public receipts omit raw responses/images. Supply those existing private inputs if the workspace is recovered, never access the44heldouts or dispatch fresh provider scans.

The build/local HTTP gate is complete. Next release gate is staging verification of real session/entitlement/RLS behavior and native purchase/restore against their actual services, plus the still-unresolved reference-backed semantic acceptance required for trading/pattern/liquidity claims. Local fixtures do not establish those external facts. No production activation, main merge, deployment or store release is authorized by this checkpoint.

Effects:0paid calls,0new spend,0live database/customer writes,0heldout reads. Schedules remain OFF. No deployment or merge. Automatic Vercel deployment is disabled for this isolated branch. Original US$5 accounting and all retained scan results remain unchanged.

The published executable tree `ee11f6522d1ec11911f103890ae4fc7a5daa65b9` equals tested/reviewed local commit `2dd188ca336e7fad1d3d3ca36abfb88839cbd566` exactly; only commit metadata differs.
