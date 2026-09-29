# Pocket Bullseye app sweep — 17 September 2026

## Scope

Review the existing phone-first app, fix confirmed defects, finish the current cosmic design across older panels, and implement useful competitor-informed improvements without adding a paid data feed or changing measured chart geometry.

## Changes

- Clear corrections, prior answers, refinement state, privacy confirmation and result overlays when starting or replacing a primary chart. Preserve a notebook review target while choosing its later screenshot.
- Review Done returns through the complete exit path. Review intake includes Back to my notebook; notebook navigation moves keyboard focus as well as scroll.
- Keep the accuracy panel mounted while corrected fields change, preserving its confirmation and replay action. Handle blocked/quota-limited storage; distinguish session-only feedback from saved feedback. Fictional samples cannot add accuracy ratings.
- Correction replay restores the active timeframe's completed report. Background preparation can resume from any completed view. Opening a ready real chart saves it to the existing notebook with deduplication.
- Bound follow-up and review requests, including response-body reads, with cancellation and session checks. Prevent obsolete replies from appearing after a new chart. A completed review save still refreshes notebook state when the customer leaves during persistence.
- Recompute a submitted trade-plan review against changed analysis. Preserve the entered plan; do not retain a stale result from an earlier analysis.
- Contain keyboard focus in result-card and completion overlays; support Escape and restore the launch control. Cinematic autoplay starts paused when the device requests reduced motion. Background pause covers older CSS animations too.
- Finish older accuracy, journal, follow-up, preflight, risk/review, provenance, navigation and message surfaces with shared glass materials, legible typography, accessible focus and larger controls. Supply a safe sans-serif fallback when the bundled font variable is unavailable.
- Show a retake's corrective instruction outside the collapsed diagnostics and link back to the uploads.
- Reduce notebook filter clutter; add Awaiting review, a filter count and Clear filters. Add optional user-entered Taken / Waited / Passed decisions and precise saved timestamps. Preserve these decisions in backup/restore; never infer an executed trade for older entries.

## Research and decisions

Reviewed official competitor and guidance sources against the previous day's benchmark. Product documentation verifies advertised workflows, not accuracy or trading outcomes.

| Source | Relevant finding | Decision |
| --- | --- | --- |
| [Chartick FAQ](https://www.chartick.ai/faq) | Missing scale/labels and poorly framed charts affect screenshot reads; its confidence description distinguishes indicator agreement from probability. | Surface a useful repair instruction at the point where preflight pauses. Preserve Pocket's conditional, evidence-based wording. |
| [TrendSpider analysis timestamps](https://help.trendspider.com/kb/automated-technical-analysis/truth-in-analysis-timestamp) | Exposes analysis timing and distinguishes locked from refreshed context. | Display an exact saved timestamp in the existing notebook metadata. Do not call saved time chart capture time. |
| [Edgewonk psychology](https://edgewonk.com/trading-psychology) | Tracks decisions, missed trades, reflection and lessons. | Record the user's action separately from AI interpretation in the existing notebook. |
| [TradeZella notes before trades](https://help.tradezella.com/en/articles/11517879-create-a-trade-note-before-importing-a-trade-and-link-it-later) | Reasoning can exist before an executed trade. | Make Waited and Passed useful recorded outcomes without requiring a trade. |
| [TradeZella trade page](https://help.tradezella.com/en/articles/5860216-understanding-the-trade-page) | Organises review into distinct sections and collapsible navigation. | Keep search visible; disclose extra notebook filters. |
| [TradingView multi-timeframe analysis](https://www.tradingview.com/support/solutions/43000591555-leveraging-multi-timeframe-analysis/) | Distinguishes chart timeframe from calculation context. | Preserve Pocket's attributed timeframe selector and comparison rather than adding another duplicate widget. |
| [SnapPChart](https://www.snappchart.app/ai-chart-analysis) | Describes screenshot limits for subsequent prices and information outside the image. | Retain snapshot labels and verified-price provenance. |
| [Pineify chart analysis](https://pineify.app/chart-analysis) | Advertises structured levels, uncertainty and revisitable history. | No comparative accuracy claim: vendor-authored benchmark descriptions are not independently reproducible validation. |
| [W3C error suggestions](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html) and [visible focus](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Recovery guidance should be actionable; focused controls should remain visible. | Visible preflight repair, keyboard-contained dialogs and focus-aware notebook navigation. |
| [Rendering performance](https://web.dev/articles/rendering-performance) and [INP](https://web.dev/articles/optimize-inp) | Avoid unnecessary paint and blocking work; measure interaction performance. | Preserve existing scanner/offscreen suspension and reduce redundant UI. No unmeasured INP or speed claim. |

## Verification

- 1,084 automated unit/render checks passed; none failed or were skipped.
- TypeScript completed successfully.
- Browser checks confirmed ready timeframe switching, disclosure navigation/focus, full-screen map exit, notebook focus and unlocked scrolling, correction replay button persistence, storage-failure messaging, dialog keyboard containment/Escape and the saved Waited decision.
- Interactive component layouts checked at 390px and 320px frame widths, with no horizontal overflow in the compact layout. These are browser checks, not physical iPhone tests.

## Validation boundaries

Automated unit/render tests, TypeScript and the production build validate the code and contracts. Browser walkthroughs validate the sample's actual report/navigation and interactive component fixtures at phone widths. Fixtures use fictional data and are removed before packaging. Native purchasing, physical iPhone rendering and a new paid-provider real-chart precision benchmark are not established by these checks. No claim that all possible bugs are eliminated or that Pocket is more accurate than competitors.

Apple review submissions and revision pins remain untouched; routine native changes are saved in the existing next-release draft.
