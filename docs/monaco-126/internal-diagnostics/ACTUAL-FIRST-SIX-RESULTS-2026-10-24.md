# Independent review of the six diagnostic attempts

**All six attempts now have retained evidence. They are not six successful or accurate scans.** There are **14 genuine retained provider responses**: two from original run 40083992183 and 12 from continuation 40086015008. The continuation retained five diagnostic records; d001 contributes a separately labelled offline recovery of its original completed main response.

## Per-chart findings

All main responses completed and matched the supplied instrument/timeframe. Objective geometry uses a one-original-pixel tolerance.

| Case | Chart | Provider responses | Precision outcome | Raw-main axis anchors | Raw-main level assertions | Original postprocessed measurement |
| --- | --- | ---: | --- | --- | --- | --- |
| d001 | ES continuous futures, 30m | 2 | Primary output limit | 4/4 fail; 18.5–119.0 px | 2 fail, 1 unscored | UNMEASURED: incomplete precision |
| d002 | BTC crypto, 1h | 2 | Primary output limit | 4/4 fail; 8.5–31.5 px | 3 fail, 1 unscored | UNMEASURED: incomplete precision |
| d003 | AAPL stock, 4h | 2 | Primary output limit | 3/3 fail; 24.7–60.6 px | 2 fail, 1 unscored | UNMEASURED: incomplete precision |
| d004 | SPY ETF (FirstRate Data), 5m | 3 | Primary + rescue complete | 2/2 fail; 24.0–37.0 px | 2 fail, 1 unscored | UNMEASURED: observations field omitted |
| d005 | SPY ETF (FirstRate Data), 15m | 3 | Primary + rescue complete | 2/2 fail; 104.0–682.7 px | 0 fail, 3 unscored | UNMEASURED: observations field omitted |
| d006 | SPY ETF (FirstRate Data), 5m | 2 | Primary output limit | 3/3 fail; 104.0–682.8 px | 2 fail, 1 unscored | UNMEASURED: incomplete precision |

The two 5m SPY cases are distinct case inputs. Unscored level assertions include six pivots and d005's two approximate-price horizontals. They are not counted as passes or failures.

## What the evidence proves

**Output budget:** four primary precision responses ended with max_output_tokens. d001 used 1,400 tokens, including 832 reasoning tokens; d002 used 1,344 tokens entirely for reasoning and produced no text; d003 used 1,400, including 1,216 reasoning tokens; d006 used 1,400, including 1,152 reasoning tokens. None became completed precision and none gained a new rescue path. d004 and d005 used their original conditional rescue; all four of their precision/rescue responses completed.

**Geometry:** all 18 raw-main axis anchors are nonconformant, and all 11 scoreable horizontal level assertions are nonconformant. This is an objective coordinate/price result, not a semantic trading-accuracy percentage. d005 also has one channel assertion that fails the existing structural/source-wick geometry checks; its pattern name and market meaning remain unscored. Empty pattern/pool outputs are not true negatives and do not establish false negatives.

**Postprocessing interface:** d004 and d005 completed every provider response, but their original postprocessed diagnostic result is UNMEASURED/MALFORMED_OBSERVATIONS. The unchanged calibration's empty liquidity object omits observations, while the unchanged diagnostic normalizer requires that array. This is a deterministic producer/consumer mismatch, separate from output truncation. These original artifacts remain unchanged. Any later recovery must be separately labelled and treat omitted observations as unavailable, never as a verified empty array.

**Coordinate cause:** d001's wrong rows and plot bounds are already in the native provider message. Its request uses the exact original 1,400×850 PNG with identity crop and full-image-percent instructions. The diagnostic conversion agrees with the source calibration. No deterministic application transform defect was established. d005/d006's 0.xx coordinates are consistent with a provider unit mistake, but multiplying them by 100 is not an accepted correction or a proven quality fix. See the separate d001 coordinate-cause review.

## Limits and provenance

The independent review checks all 17 successor plaintext files against root's decryption receipts, joins each diagnostic to its exact raw response digests, and confirms 14 unique provider request/response IDs. Official artifact run/source/digest checks and database receipts establish provider provenance separately. Generic diagnostic fields such as actualProviderResults:0 and NOT_ATTESTED_BY_DIAGNOSTIC_WRAPPER remain untouched; they describe the wrapper's limited authority, not the number of real provider calls.

Successor hosted case intervals are 55.146s, 66.994s, 62.775s, 68.454s and 59.069s (range 55.146–68.454s, median 62.775s). They include sequential requests and accounting and are not deployed HTTP/UI latency. d001's 35s figure is only its main provider server timestamp interval, so no mixed six-case latency average is reported.

This review made zero provider/database calls, read no private key and used no held-out payload. It asserts no actual billed cost, financial settlement, expert acceptance or production readiness. The unchanged hosted artifacts contain **zero fully scored postprocessed cases**: four are unavailable due to incomplete precision and two due to the observation-array mismatch. The separate partial recovery below preserves those original outcomes.


## Execution and financial reconciliation

The protected continuation [run 40086015008](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/40086015008) and job 120849000937 finished successfully at 10:38:41 UTC on 24 October 2026. Executable `f3d86adeddffa7d4bfbcd7390ce92fcafeb2651c`, evidence `6ac76987c9a66260cf6fe3ba24745b20c6286aaf` and wrapper `8fb7ca85d2af2a10849cfad27c5b58581ace22db` were separately pinned. [Exact-source CI](https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/40085717845) passed all 47 focused tests, including PostgreSQL 17.11 integration, with no failures or skips. These tests establish execution controls, not chart accuracy.

The final ledger has six accounted cases, 14 submitted calls with 14 receipts and four voided unused slots. Independent correlation matched every retained provider request ID, response ID, model and input/output/total usage to that ledger. All original request pins and d001 accounting remain unchanged. **$1.5064 is held as the conservative submitted-request ceiling, leaving $3.4936 of the original aggregate $5 allowance.** Actual billed dollars remain unknown and financially unsettled; the ceiling must not be reported as an invoice total.

The runner was returned to NOLOGIN, with zero sessions independently verified at 10:39:45.697 UTC. Scheduled work remains off. The 44 held-out cases were not read or run. The original responses and all 17 continuation artifacts are saved privately with verified hashes; no chart images, private keys or raw provider payloads are published here.

## Prepared output-budget correction

A separate [precision-v2 proposal](../precision-v2-output-budget/PROPOSAL.md) and applicable patch raise the shared precision cap from 1,400 to 4,000 and reject genuinely incomplete precision before parsing it. The existing rescue condition and no-retry policy remain unchanged. It passed 23 targeted offline tests plus a control using the unchanged retained d001 response, with independent code review. It has not been applied to the frozen executable, admitted to a paid run or deployed. A larger cap alone does not establish completion, correct geometry or acceptable endpoint latency; the existing 55-second client/60-second route limits still matter.

## Source verification and truthful UI status

Independent review found that server calibration checks whether model anchors agree with one another; it has no original-pixel/OCR input. The browser already has an independent image-based verification and correction path, but its measured result is not returned to the parent status labels. Numeric model levels alone currently feed the `VERIFIED LEVELS` text. The next source-verification correction should bind verified-placement counts and labels to the existing measured image/report result. Valid OCR-corrected placement must remain distinguishable from an accurate original model coordinate, and semantic support/resistance truth remains unscored. Tightening model self-consistency alone cannot establish source accuracy.


## Separate offline recovery of d004 and d005

The two cases with completed main, primary and rescue responses were reconstructed through the complete unchanged frozen merge/calibration function. A narrowly bound offline adapter evaluates valid level and axis fields without injecting the missing liquidity observations. This required **zero additional provider calls**. Original hosted artifacts retain `UNMEASURED / MALFORMED_OBSERVATIONS`; these are separately labelled reconstructed results, not previously retained final output.

| Recovered case | Axis measurements | Level measurements | Omitted liquidity observations |
| --- | --- | --- | --- |
| d004 | All 3 anchors nonconformant | 1 horizontal nonconformant; 2 assertions unscored | Unavailable; count is null |
| d005 | All 3 anchors nonconformant | 1 pivot unscored; no retained support/resistance | Unavailable; count is null |

The recovery passed three focused regression checks and independent implementation/hash/arithmetic review. It preserves the original source bindings, full-image pixel units and geometric tolerance, and grants no true-negative or semantic credit to absent data. Both reconstructed objects still label their model-derived scale readable, while all six recovered anchors fail the independent source scale check. This supports the need to distinguish model calibration from verified source placement.

**Outcome:** all six authorized diagnostic attempts have genuine retained evidence, the execution blockage is cleared, and the measured scanner defects have specific reproductions. Scanner accuracy and release readiness remain unestablished.
