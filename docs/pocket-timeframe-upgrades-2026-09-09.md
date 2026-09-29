# Pocket Bullseye: uploaded timeframe controls and scan comparison

The selected uploaded chart now owns the entire result. A shared, persistent selector applies to the cinematic result, written verdict, tools, intelligence maps, levels, patterns, liquidity, scenarios and Ask Bullseye. The controls also appear beside maps and in the expanded chart.

## Customer behaviour

- Up to five uploaded screenshots remain selectable, including two different crops of the same timeframe. Labels come from the visible chart; an unreadable timeframe is labelled Chart 1–5 until analysed. Monthly and minute labels remain distinct.
- First selection of another screenshot runs its full analysis with that image as primary. The other uploads remain available as supporting evidence. Returning to a ready view uses its cached report without another provider request.
- The active screenshot, levels, patterns and complete report switch together. A failed request leaves the previous result and every uploaded image intact. Rapid taps cannot create duplicate selection requests; stale results cannot replace a new upload session.
- Follow-up questions, level and liquidity rescans use the selected chart. Supporting-image geometry and patterns cannot be drawn on another screenshot. Existing entitlement checks apply to additional AI requests.
- Successful scans are saved to the existing private journal on the device. What changed? selects a different earlier saved screenshot of the same instrument and timeframe. The comparison also checks the visible instrument, timeframe and chronology; unproven comparisons remain inconclusive. It does not infer profit or loss.
- The sample demo contains five explicitly fictional chart/report pairs: 5M, 30M, 1H, 4H and 1D. Switching and inspecting the demo require no provider calls or free-analysis credit.
- A failed or unreadable initial scan does not consume the native app's free analysis.

## Reliability and validation

Server logs now contain a scan ID, terminal outcome, duration, chart count and available provider usage by phase. They omit screenshots, prompts, prices and customer identity. `node scripts/pocket-reliability-report.mjs /path/to/exported-runtime-log.txt` summarizes the supplied log window. This is operational telemetry, not a claim of trading accuracy or a complete provider bill.

Validation includes the full existing unit/render suite, TypeScript checks, a successful Sites production build, and 15 targeted behaviour/render tests covering five-source switching, cached return, sparse uploads, failed/stale requests, free-use protection, comparison cancellation, monthly labels and all demo maps. Existing native progress stages and decision timelines are retained in the GitHub candidate. The native candidate's timeout tests are aligned with the already accepted report-recovery budget.

No live paid-provider benchmark or interactive device/browser QA was performed for this change. Build 28 already submitted to Apple is a separate immutable release; these changes require a subsequent native release to reach that installed app.
