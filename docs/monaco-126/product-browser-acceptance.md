# Synthetic example — supported browser acceptance

Scope: `product-demo.html` only. This is not scanner, signed-device, subscription or provider acceptance. Browser status is **BLOCKED pending root's supported Browser/managed-preview execution**. The isolated product track does not have an available local browser binary. No browser was downloaded. A failed launch attempt produced no screenshots and no interaction evidence.

Use the repository's supported preview mechanism; root owns the final SHA and preview. Browser must visit the actually integrated file (not a hand-recreated HTML fragment). Do not enable API access, uploads, real screenshots, analytics or subscriptions for this demo.

## Test cases and exact expected observations

| Case | Action | Expected acceptance |
| --- | --- | --- |
| DEMO-01 | Load at 390 × 844 and 1280 × 900 | Synthetic notice, Pocket public name, chart, controls, HOLD explanation; no horizontal document overflow. |
| DEMO-02 | Select each of the four examples | Exactly one pressed button; chart and reason belong to that example. All are labelled DEMO HOLD. No trading instruction or invented accuracy. |
| DEMO-03 | Choose Unclear price axis | Numeric price-axis labels and level bands withheld. Reason states axis cannot be confirmed. No exact 100/104 prices in evidence text. |
| DEMO-04 | Choose No clean pattern | No asserted bands or forced pattern label. Explicitly a designed negative illustration, not a measured model true negative. |
| DEMO-05 | Choose Timeframe conflict | Short-term range versus predefined 4h downward context described honestly; not presented as computation from a missing second chart. |
| DEMO-06 | Review current example, then change example | Confirmation matches selected example; switching resets confirmation and retains no stale text. |
| DEMO-07 | Tab through controls, use Enter and Space | Clear focus; scenario buttons activate; 44px touch targets; labels reachable by keyboard. |
| DEMO-08 | Inspect 320, 390, 768 and 1280px widths | Controls wrap, chart stays inside panel; evidence remains readable; no clipped action/notice. |
| DEMO-09 | Inspect supported browser network/error observations | No remote dependency or outbound API/data requests; no console/page errors. CSP has connect-src none. Source safety guard is supplemental only. |
| DEMO-10 | Reload | Only default synthetic range is shown. No account, user image, cookies or local/session persistence introduced by demo code. |

Root records actual viewport, browser, exact integrated commit, preview URL, screenshots and observed results in `product-verification.md`. If network/error inspection is unavailable, mark that aspect UNTESTED; do not infer it from rendering.

## Rollback

Remove the new demo link/file from the unpublished candidate. No runtime route, scanner, entitlement or customer state was altered. Store screenshots and marketing distribution remain blocked on their separate gates.
