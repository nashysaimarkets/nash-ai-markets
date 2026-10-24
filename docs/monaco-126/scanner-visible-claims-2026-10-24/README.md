# User-visible scanner claim validation — release HOLD

Base executable: `a3b108d59d4cd530b326a0e9a106e671aaead265`. Isolated owner: claims-layer-20261024; branch `monaco-visible-claims-20261024`. PR147/148 unchanged. Source hashes in FINAL-REVIEW.json pin the implementation independently reviewed.

## Changes

Main analysis, cached reports, both scanner UIs and Level Lab now validate report shape before rendering. Missing fields, malformed coordinates, nested object/array substitutions and incomplete explicit provider status are rejected. Level Lab previously accepted parseable JSON from an incomplete provider response: the actual route's success path independently reproduced this defect and now rejects it. No provider output is repaired by inventing missing content.

Reported prices and coordinates remain intact. Provider labels cannot assert independently verified price roles; candidate labels and a shared UNVERIFIED notice distinguish model claims from image-bound price placement. Contradictory equal-high/low liquidity sides produce HOLD. Patterns, hidden liquidity, scores and trading conclusions remain UNVERIFIED, including exports. Empty pattern output no longer claims absence. Existing source measurement and original-pixel geometry algorithms are unchanged; they verify position, not candle extremes or trading accuracy. Confirmed metadata does not validate model reasoning.

Eight retained genuine MAIN reports survive validation with original prices and raw input preserved. The original 20-response audit, its four attribution failures, two liquidity-side errors and four incomplete responses remain authoritative. Original provider mistakes are not relabelled as app defects or fixed by reference substitution. The 20 prior semantic controls, accepted 75 application tests and prior 15 audit checks are reused, not counted as fresh executions. The 44 held-out cases remain untouched.

## Verification and limits

- New targeted controls: 20/20, zero skipped; independently rerun, not double-counted.
- Affected integration/workflow-export tests: 8/8, zero skipped.
- Independent review: ACCEPTED_CODE; eight retained positives, nine distinct malformed counterexamples (sets overlap), actual completed/incomplete Level Lab route-slice checks.
- Strict TypeScript for the new validation module and its transitive dependencies/tests: PASS. Actual UI components bundle with esbuild for local Chromium.
- Full repository TypeScript check: PASS using a discovered existing complete dependency set, no package download. Changed-file lint: zero errors, five pre-existing unused-code warnings.
- Full Next production build: BLOCKED solely by Geist/Geist Mono Google Fonts fetches denied by the explicit offline network guard (BUILD-BLOCKED.txt). No production build success is claimed.
- Actual full-stylesheet Chromium five-chart workflow: PASS5/5 plus6 lifecycle/customer checks, no browser exceptions or external requests. Nine original-image price rows: PASS9/9, maximum0.49999562784540785px against unchanged1px tolerance. Browser and coordinate receipts are saved separately. They use actual UI/source code, local API transport with retained results, manual chart fact confirmation, and existing OCR assets. Native plugin web adapters are stubbed. This is not production HTTP/auth, provider, or physical-device acceptance. d001/d003/d004/d005 use retained MAIN through accepted calibration; d002 uses the complete retained repaired replay.

No paid/provider/DB calls, new spending, held-out access, scheduled work, deployment or merge. The isolated branch explicitly disables automatic Vercel deployment. No PR or workflow dispatch is needed for this checkpoint.

## Next executable release gate

Supply the existing Geist/Geist Mono build assets offline and complete the exact saved source Next production build and production HTTP/auth integration checks, preserving earlier evidence. No font replacement or external request was performed. Keep release HOLD until this exact-source integration is accepted. Any claim of scanner trading/pattern/liquidity accuracy additionally requires independent reference-backed semantic acceptance; this safety layer and nine price-position passes do not establish it. No paid scan, database activation or release action is authorized by this checkpoint.
