# Reject invalid chart bounds without inventing geometry

## Current result

This isolated candidate fixes a deterministic defect exposed by the first revised live scan. It preserves invalid or missing model bounds, withholds dependent drawing geometry, and prevents an internally linear pair of model anchors from making an invalid plot readable. It does not locate the correct chart rectangle or repair the model's coordinate accuracy.

The genuine evaluated case and its unchanged failure are recorded in [PR145's first-case outcome](https://github.com/nashysaimarkets/nash-ai-markets/blob/b4d5a71c8077f43a83c29e551eb4cce5bb463e19/docs/monaco-126/scanner-evaluation-v2-2026-10-24/execution/FIRST-CASE-OUTCOME.md). Its runtime `20783ed5e8eb95a11df86b0d60766ffcbbf4fa79`, raw responses, source oracle and one-pixel tolerance remain frozen.

## Change

The existing production liquidity rectangle check is shared with calibration. Four finite numeric percentages within 0–100, ordered left-to-right and top-to-bottom, are required. Calibration no longer supplies default plot edges, clamps malformed bounds, or expands a rectangle by a minimum percentage point.

Invalid bounds leave the supplied bounds and anchors intact as evidence. Levels, Fibonacci lines and liquidity zones that depend on those bounds are withheld. Scale readability becomes false. Existing liquidity candidates remain PARTIAL with a BLOCKED evidence chain; empty, missing, malformed and nonempty witnesses retain their original meanings. No fraction-to-percent conversion is inferred.

## Retained-case replay

The baseline replay exactly reproduces the saved diagnostic. For raw top100/bottom20, the baseline manufactures bottom101 and marks the scale readable. The candidate preserves top100/bottom20, marks the scale unreadable, and exposes the blocked liquidity reason. It still draws zero levels. The four original raw levels still fail the unchanged geometry criterion; withholding bad assertions earns no accuracy or absence credit.

[Retained replay](RETAINED-REPLAY.json) and [exact local replay command](REPLAY-COMMAND.sh) preserve the evidence. The command requires the existing private retained outputs; it makes no provider request.

## Verification and identity

[Local acceptance](LOCAL-ACCEPTANCE.json): **68 distinct checks passed across ten affected files, including ten new regressions and 58 existing checks.** The new regression file produced two passing and eight failing cases on the baseline, then ten passing cases after repair. Its separate green run is included in the68 total. The local default-process harness failure and the same-test isolation-free fallback are retained honestly; hosted CI uses the normal process model.

[Independent review](INDEPENDENT-REVIEW.json) accepted the exact file hashes for isolated source publication. Downstream image, level, pattern, liquidity and stale-measurement guards were inspected without repeating tests. The bounded hosted workflow checks the actual published commit, the affected suites, TypeScript integration, changed-source lint and secret scan. Hosted acceptance is pending at this source publication; a later receipt will identify its actual run and outcome.

Base commit: `b118c7a38a35514eb4cbd4cc86b3341de91a5ca5`, whose app source is the accepted `2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc`. The enclosing source commit and [reviewed source hashes](SOURCE-IDENTITY.json) identify this candidate; the base is not presented as the changed source.

Branch: `monaco-scanner-geometry-repair-126-20261024`. Automatic deployment is disabled. Root alone writes remotely under Issue126 claim6384437116 and extension6384669426.

## Remaining work

Image-derived plot localization is being developed separately because the existing OCR path depends on model bounds, model tick prices and levels surviving API calibration. That separate work is not accepted by this patch. All remaining paid evaluation cases stay HOLD. The first-case migration/admission and invocation are already consumed and must not be replayed. Runner cleanup and temporary environment-rule removal are complete.

This candidate does not change prompts, model selection, provider calls, price policy, scoring tolerance, production, main, Apple release or schedules. Schedules remain OFF.
