# Pocket Bullseye — product evidence and bounded priorities

Owner contract: [issue #126](https://github.com/nashysaimarkets/nash-ai-markets/issues/126), Commands H/I and brand portion of C. Researched 19 October 2026. Reuses [#113](https://github.com/nashysaimarkets/nash-ai-markets/issues/113) and [#115](https://github.com/nashysaimarkets/nash-ai-markets/issues/115); their 18 October research was read once. Public product remains **Pocket Bullseye**. No provider purchase, account creation, outreach, store change or publication occurred.

## Evidence boundary

REAL PASS means a public primary source was retrieved, not that its product was independently tested. Vendor speed, training, accuracy, user-count and profitability claims are not adopted. Prices below are observed displays, not checkout quotes; currency, region, tax, promotions, billing term and renewals matter. Do not compare annual effective monthly prices with Pocket's cancellable monthly subscription as if equivalent.

The Stripe Directory skill was read before external service research. The CLI was unavailable; the directory landing page redirected to its documentation, not an authenticated search result. No verified Directory provider selection or engagement was possible. This did not require connecting a new service: the work below verifies the named competitors in the owner's contract using their own pages and stores. No substitute service was provisioned.

## Current official comparison — delta over #113

| Product | Observed feature evidence | Price evidence on 19 October | Implication for Pocket / certainty |
| --- | --- | --- | --- |
| TradingView | Official support documents automatic-pattern alerts, indicator/drawing alerts and configurable notifications; pricing page lists automatic chart patterns and multi-timeframe analysis. | Opened canonical page rendered CHF 12.95/month Essential, CHF 29.95 Plus, CHF 59.95 Premium, CHF 199.95 Ultimate **billed annually**. Search rendering showed USD; neither is a UK checkout quote. Plan-specific pattern eligibility was not safely recoverable from the text-only feature matrix. | REAL PASS documentation. Do not advertise an exclusive ability to detect patterns or add alerts. Do not infer every listed feature belongs to Essential. [S1–S3] |
| TrendSpider | Help documents automatic swing-derived trendlines and displaying another timeframe's trendlines on the current chart. Pricing includes automated trendlines/Fibs, patterns and multi-timeframe tools. | Promotional/renewal ranges vary by plan and billing term; the Advanced display includes USD 154.08/month initial annual offer with later pricing ranges. No stable UK equivalent verified. Existing #113 already records September/ August changelog evidence; not re-researched. | REAL PASS documentation. Compete through readable evidence and a small mobile workflow; avoid rebuilding backtesting/bots. [S4–S5] |
| LuxAlgo | Price Action Concepts documents BOS/CHoCH, equal highs/lows, sweeps, gaps and multi-timeframe structure. | Canonical current platform page shows Premium USD 27.99/month effective initial annual price, USD 335.92 first charge, USD 479.88/year renewal; displayed undiscounted monthly figure USD 39.99. It now presents Vela/Quant/library/Orderflow together. | REAL PASS documentation. A static screenshot cannot justify the same order-flow/volume assertions as underlying trades. No copying toolkit code or artwork. [S6–S7] |
| Autochartist | Official support explains patterns, quality/clarity measures and statistically derived volatility ranges; current site confirms product availability. | No fixed direct retail subscription price established from retrieved official pages. Broker offers are not a universal price. | REAL PASS documentation. An expected move requires actual suitable historical data; do not manufacture one from a screenshot. [S8–S10] |
| ChartShot | Website and GB App Store support screenshot/photo input, long/short/hold framing and saved history. Website expressly says AI analysis requires its auto-renewing subscription; no free analysis mode. | GB IAP: **£7.99 weekly / £29.99 six months**. The second term is roughly £5/month equivalent only before renewal/offer checks; not a month-to-month offer. | REAL PASS public listing, not a purchased scan. Pocket's £4.99/month is not automatically an excessive price; quality and a credible demonstration are the nearer problems. [S11–S12] |
| ChartAIScan / Chart AI | Official website's store links resolve to **Chart AI: Forex Scan & Signals**, Hilvy Ltd, Apple id6749821998 and Android com.hilvy.chartaiscan. Site promotes free core scanning and premium batch/MTF/history; store lists screenshot analysis, confidence and saved scans. | GB Apple IAP lists **£4.99 weekly / £14.99 monthly**, while description states £15.99 monthly. Website premium price is not published in the retrieved comparison. | REAL PASS identity links; price/free-access inconsistency remains unresolved. Do not adopt its speed or accuracy claims or assume website/free tier equals in-app entitlement. [S13–S16] |

## Confirmed public funnel findings

| Finding | Observed proof | Severity / next action |
| --- | --- | --- |
| First-free promise conflicts with candidate release policy. | Pocket's current GB listing says one complete analysis free, then subscription. #126 requires first-free gated OFF until expressly accepted. | **FAIL — copy/policy mismatch.** Commerce/native owner must compare signed build + web pin + paywall + actual entitlement, then owner approves the intended policy. Do not enable free access to make copy true. Draft in `product-growth-assets.md` removes an unsupported free promise for the proposed candidate. [S17, #126] |
| Privacy destinations differ. | Listing description uses `https://pocket.nashaimarkets.com/privacy`; Apple developer privacy link resolves to `https://www.nashaimarkets.com/privacy`. | **UNTESTED destination equivalence.** They may be compatible, but both must load the correct app/controller/subprocessor/retention policy before final metadata approval. Do not call a URL discrepancy a proven legal defect. [S17] |
| Listing and new product appearance have separate release state. | Public listing's visible current version is 1.2.14, 30 September. Owner contract identifies live Sites v179; those numbers are different products' version systems. | **BLOCKED native acceptance** until immutable web pin/signed archive is verified by native QA. Store metadata is not proof of runtime source or native purchases. [S17, #126] |
| Subscriber counts / conversion / churn unknown. | Owner reports one subscriber; App Store has one rating. | **UNTESTED commercial metrics.** Rating count is not subscriber count. Do not create community/testimonial/traction claims. [S17, #126] |
| Public landing/robots/sitemap/privacy fetch could not complete through research tool. | `pocket.nashaimarkets.com`, `/robots.txt`, `/sitemap.xml`, `/privacy` each returned tool-inaccessible, 19 October. | **BLOCKED read-only SEO check, not a site outage finding.** Reuse verified live auth/routing repair; next operator checks HTTP result and branded rendered page in the authorised runtime/browser. No request to `/api/openai/health`. |

## Ranked small improvements

These are product judgments, not observed conversion uplift. Ranks balance useful differentiation, implementation size, licensing and measured acceptance. Existing implementations must be reused before adding files to the release candidate.

| Rank | Work | Expected customer value / conversion hypothesis | Extra cost and rights | Maintenance / acceptance |
| --- | --- | --- | --- | --- |
| 0 | Six real provider cases, usable negative/volume/liquidity results and clear retry/cancel | Essential trust; a demo cannot substitute for it. | Existing capped benchmark only after finance gates; actual chart rights required. | P0 scanner owner. Report TP/FP/FN + unmeasured failures separately; no invented precision. |
| 1 | Evidence/readiness checklist bound to exact chart revision, readable HOLD reasons and MTF conflicts | Reduces uncertainty about why output is withheld; tests whether visitors understand a second opinion. | No extra AI, feed or vendor call. | Reuse existing Decision Gate under #113. Positive: confirmed fresh same-chart evidence. Negative: stale/wrong chart, cancelled, axis unconfirmed, timeframe/instrument mismatch. Readiness is never a buy/sell instruction. |
| 2 | No-credit interactive synthetic demonstration | Lets a visitor understand output before committing money. | Zero API/data licence cost; original fabricated candles explicitly marked synthetic. No customer images, real prices or subscriptions. | Implemented as `product-demo.html`, tested by `product-demo.test.mjs`. It is separate unpublished marketing material, not production scanner proof. |
| 3 | Export current evidence and reasons to wait into an existing journal | Makes value tangible and reviewable without promising profit. | No new AI call; customer owns/downloads their own report subject to existing policy. | Reuse existing journal/export. Test no stale other-chart data; no tokens/PII in export; cancelled/invalid report refused. |
| 4 | Image-derived equal highs/lows and simple gap candidate labels | Familiar structure vocabulary while preserving visible provenance. | Do not copy code. Needs adequately recovered candles; no actual resting-order claim. | Scanner owner only after P0. Require positive and negative originals, body/wick convention, tolerance and source endpoints; no “institutional liquidity” certainty. |
| 5 | BOS/CHoCH with confirmed close, configurable swing convention | Some parity value; considerable definition/false-positive risk. | No feed if restricted to adequately visible screenshot; proprietary logic not copied. | Defer until geometry proof and labelled tests exist. Must distinguish candidate vs confirmed and avoid look-ahead swings. |
| 6 | Instrument-specific event awareness | Useful only with verified timing/source and instrument mapping. | Official calendar terms, refresh and timezone work; no speculative “live” flag. | Reuse existing event code. Unknown/stale calendar => “Event context unavailable”, not “No events”. |
| 7 | Notifications, live scans, orderflow, options walls | Potential value, larger scope. | Market data redistribution, monitoring, push, vendor/broker rights and costs unresolved. | Keep out of this launch gate. Screenshot-visible strike concentration is not dealer gamma exposure or a complete options wall. |

No feature in this table is claimed shipped by this document. The implemented demo is an independently reviewable example. Its fixture assertions do not affect production scanner acceptance.

## Source register — retrieved 19 October 2026

- S1 https://www.tradingview.com/pricing/
- S2 https://www.tradingview.com/support/solutions/43000520149-introduction-to-tradingview-alerts/
- S3 https://www.tradingview.com/support/solutions/43000763315-getting-started-with-technical-alerts/
- S4 https://help.trendspider.com/kb/automated-technical-analysis/automated-trendline-detection
- S5 https://trendspider.com/pricing/
- S6 https://www.luxalgo.com/library/indicator/luxalgo-price-action-concepts/
- S7 https://www.luxalgo.com/pricing/
- S8 https://support.autochartist.com/en/knowledgebase/article/pattern-results-details
- S9 https://support.autochartist.com/en/knowledgebase/article/an-introduction-to-volatility-analysis
- S10 https://www.autochartist.com/
- S11 https://chartshot.app/
- S12 https://apps.apple.com/gb/app/ai-chart-analysis-chartshot/id6803578221
- S13 https://www.chartaiscan.com/stock-analysis-app/
- S14 https://www.chartaiscan.com/ai-chart-scanner-free/
- S15 https://apps.apple.com/gb/app/chart-ai-forex-scan-signals/id6749821998
- S16 https://play.google.com/store/apps/details?id=com.hilvy.chartaiscan
- S17 https://apps.apple.com/gb/app/pocket-bullseye-ai-charts/id6806004581

## Handoff / rollback

This track changes only unpublished docs and a local demo; root records exact integrated SHA/PR in `product-verification.md`. Rollback is removal of these new files. No runtime setting, live route, pricing record, entitlement or native binary is modified. Remaining dependencies: root independently reviews demo; commerce/native resolves copy-policy mismatch; scanner owner completes genuine provider gates; owner approves publication and marketing/privacy review.
