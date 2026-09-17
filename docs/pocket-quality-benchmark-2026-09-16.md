# Pocket Bullseye: competitive quality review

Reviewed 16 September 2026. Scope: ten representative charting, automated analysis, screenshot-analysis and journaling products, using their official product documentation. This is a capability and product-design comparison, not an independent accuracy ranking or an exhaustive census. Vendor statements describe advertised behavior; they do not establish measured superiority.

## Product direction

Keep the cosmic depth, moving background and tactile scanner. Make the first screen answer four questions: what chart is this, what is actually visible, what would change the interpretation, and what should I inspect next? Put deeper tools one tap away. The differentiation to pursue is an engaging screenshot-to-evidence-to-review workflow whose uncertainty is easy to understand.

Trying to match a professional terminal feature for feature would dilute Pocket. Screenshot analysis cannot recreate an exchange data feed, invisible indicator values, order-book liquidity or subsequent price movement. An attractive interface becomes a quality advantage when every interaction helps inspect the evidence.

## Competitive findings

| Product | Documented strength | What Pocket should learn | Boundary of the comparison |
|---|---|---|---|
| TradingView | Technical Ratings has a published calculation using 26 indicators and multiple timeframes. | Make score meaning and timeframe identity inspectable; distinguish an interpretation from a probability. | Its default US equities feed may differ from primary-exchange data. Even chart platforms need source labels. [Ratings](https://www.tradingview.com/support/solutions/43000614331-technical-ratings/), [data sources](https://www.tradingview.com/support/solutions/43000473924-is-us-stock-market-data-free-by-default/) |
| TrendSpider | Automated chart analysis, multi-timeframe overlays, scanners and strategy testing. | Preserve chart/timeframe attribution and distinguish a forming condition from a completed candle. | Its scanner can use current unfinished candles or completed candles. Pocket cannot infer completion solely from a screenshot timestamp. [Analysis](https://trendspider.com/product/analyze-and-chart-any-market-asset/), [timeframes](https://help.trendspider.com/kb/automated-technical-analysis/multi-timeframe-analysis), [current candle](https://help.trendspider.com/kb/scanner/multiple-timeframes-and-the-current-candle) |
| Autochartist | Pattern details expose symbol, interval, identified time and quality dimensions; separate performance statistics summarize historical outcomes. | Keep evidence quality separate from outcome statistics and provide inspectable pattern provenance. | Historical aggregate forecast results do not justify a win-probability badge on an individual Pocket screenshot. [Pattern details](https://support.autochartist.com/en/knowledgebase/article/pattern-results-details), [statistics](https://support.autochartist.com/en/knowledgebase/article/performance-statistics) |
| Trading Central | Technical Insight combines technical events, directional interpretation and several time horizons. | Pair each interpretation with the condition that supports or weakens it. | Breadth of event coverage is a documented feature, not proof of accuracy relative to Pocket. [Technical Insight](https://www.tradingcentral.com/tc-products/tc-technical-insight) |
| Finviz Elite | Screening, watchlists, alerts, chart studies and exports. | Return visits should lead quickly to a saved instrument, previous decision or review. | Broad-market monitoring requires market-data services; it cannot be provided by decorative scanner motion. [Elite](https://finviz.com/elite) |
| SnapPChart | Screenshot analysis explicitly describes limitations and a trading-coach workflow built from multiple analyses. | Explain missing evidence precisely and connect repeated reviews to one useful behavioral lesson. | Its published limitations include information a screenshot cannot contain. [Analysis](https://www.snappchart.app/ai-chart-analysis), [coach](https://www.snappchart.app/ai-trading-coach) |
| Pineify | Screenshot analysis promotes structured levels, rationale and revisit-able analyses. | Make a saved read understandable later without requiring the user to reconstruct the original decision. | Marketing accuracy claims are not a comparable independent benchmark; no numerical ranking is adopted here. [Chart analysis](https://pineify.app/chart-analysis) |
| Chartick | Gallery/camera input and analysis history across web and mobile. | Make capture, return and review reliable across devices. | Its FAQ describes public sharing and export constraints; privacy and portability can be useful differentiation, but Pocket currently stores its notebook on the device. [Analyzer](https://www.chartick.ai/analyze), [FAQ](https://www.chartick.ai/faq) |
| TradeZella | Journal workflows connect screenshots, notes, tags, mistakes, review state and replay. | Close the loop from original evidence to later review; minimize duplicate data entry. | Trade-log CSV export and note export have different scopes. Pocket backup is not broker synchronization or full trade-account analytics. [Workflow](https://help.tradezella.com/en/articles/13863136-getting-started-with-tradezella), [CSV](https://help.tradezella.com/en/articles/9725069-how-to-export-data-to-a-csv-file-from-the-trade-log-page), [notes](https://help.tradezella.com/en/articles/6384117-how-to-download-your-notes-into-a-pdf-file) |
| Tradervue | Trade journals support screenshots and controlled sharing. | Keep chart privacy and sharing consequences explicit, and preserve a private review workflow. | Its help distinguishes private screenshots from publicly shared trades. [Images](https://app.tradervue.com/help/images), [FAQ](https://app.tradervue.com/help/faq) |

## Improvements implemented in this batch

1. Removed the duplicate Trap Radar. Its missing-result path could say LOW and its count-based severity had no calibrated risk basis. The actual Liquidity Guard remains, preserving distinct unavailable, withheld and no-visible-cluster states.
2. Fixed bearish confirmations appearing under a bullish label. Directional reads now use “Strengthens this read”; neutral reads ask for confirmation without implying a direction is established.
3. Removed heuristic bull/bear percentages from the decision surface and cinematic finale. They were derived from an AI setup score, not measured probabilities or independent evidence counts. The visual cards now distinguish the current interpretation from its alternative.
4. Preserved original numeric precision in liquidity price ranges. Narrow forex endpoints and tiny asset values no longer collapse under fixed decimal rounding. This preserves the supplied evidence; it does not make an AI-extracted price independently verified.
5. Labelled the setup grade as an AI assessment, with factor explanations on demand. Removed the standalone model-generated event-safety number from the calendar and cinematic risk chapter. Calendar context now uses actual listed events and coverage states.
6. Put the price scanner directly after the verdict, followed by decision conditions. Advanced analysis maps, chart tools, contribution details and secondary review information now expand on demand.
7. Removed two duplicate inline timeframe pickers, a duplicate save action, repeated review summaries, a duplicate evidence navigation link and unused presentation prototypes. The sticky and fullscreen timeframe selectors remain.
8. Report navigation now opens enclosing disclosures, moves keyboard focus and accounts for the measured height of the sticky timeframe bar. Snapshot wording replaces “live formation” wording in the signal tool.

Progressive disclosure is supported by [Nielsen Norman Group’s guidance](https://www.nngroup.com/articles/progressive-disclosure/): present important choices first and retain advanced options on demand. Existing background motion controls and reduced-motion support remain; [W3C interaction animation guidance](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) supports user control without requiring removal of the visual character.

9. Browser pointer testing found that the global button press transform replaced the scanner card’s centering transform, moving its hit area away before click release. The scanner now uses independent layout translation, retaining the tactile press effect without losing the tap. Pointer selection is rechecked in the browser.

## Evidence needed before claiming greater precision

The existing 33 owner-supplied IG screenshots passed the pixel extractor checks documented in `pocket-customer-corpus-results-2026-09-16.md`. Those checks establish image/candle extraction behavior, not price-reading accuracy, AI analysis accuracy or trading performance. The set is not an unseen holdout, and it does not establish coverage across brokers, gold, oil or all instrument types.

A defensible next benchmark should:

- Use the current `/api/pocket/analyse` pipeline, including its normalization and evidence gates. The existing golden runner targets a legacy generator and must not be presented as current-pipeline proof.
- Separate development images from an untouched holdout. Include multiple brokers, instrument classes, narrow forex ranges, tiny values, dark/light themes, unreadable scales, conflicting timeframes and incomplete candles.
- Have independent reviewers label instrument, timeframe, visible current price, support/resistance anchors and genuinely missing information before seeing product outputs. Resolve disagreement explicitly.
- Run compatible screenshot products on the same images and settings. For feed-based terminals, compare only shared, well-defined tasks on matched source data; do not pretend their data access is equivalent.
- Report field error rate, absolute price error in instrument-appropriate units, wrong-source/timeframe attribution, unsupported-level emission, failure-to-abstain and usable-result coverage together. A product can appear precise merely by withholding almost everything.
- Measure complete-request median and p90 latency, failure/retry rate and cost per usable report. Separate extraction timing from complete analysis timing.
- Publish sample size, exclusions, software/model versions and uncertainty around the result. Do not present subjective setup grades as calibrated probabilities.

The current local environment does not expose the analysis provider credential needed for that complete pipeline benchmark. This batch therefore makes no claim that Pocket is more accurate than these competitors. No credential is requested or bypassed by this work.

## Prioritized next development

| Priority | Recommendation | Success evidence | Dependency |
|---|---|---|---|
| 1 | Complete the independent current-pipeline benchmark and regression gate. | Low unsupported-price rate with transparent coverage, source correctness and reproducible results. | Authorized provider-enabled benchmark environment and separately labelled holdout. |
| 2 | Run a small real-iPhone usability study: inspect one level, switch timeframe, save, return and review. | Task completion, mistakes, time to inspect evidence and repeat usage; record where people hesitate. | Physical-device participants. Browser and static render checks do not replace this. |
| 3 | Add structured broker/CSV data as an optional evidence source, while retaining screenshot-first simplicity. | Prices tied to symbol, venue, timestamp and bar-completion status; cross-source conflicts shown explicitly. | Data format design, provenance and appropriate provider licensing. |
| 4 | Add opt-in secure notebook synchronization and a clear restore journey. | No lost notes across a second device, tested export/restore and explicit retention/deletion behavior. | Authentication, storage design and migration; local-only storage must remain labelled accurately. |
| 5 | Evaluate rule-based alerts only after reliable sourced data exists. | Timely, deduplicated alerts with clear conditions and pause controls. | Background data service and consent; screenshot-only motion cannot provide live monitoring. |

Keep speculative extras out of the primary report until observed customer behavior supports them. The next competitive step is stronger evidence and a smoother return-to-review loop, while preserving the distinctive look Chris wants.

## Validation record

- TypeScript check passed before final packaging.
- 52 focused tests passed: timeframe/cache behavior, provenance, liquidity verification states, progress/review behavior and four new precision/render regressions.
- Independent read-only diff review found no concrete regressions in navigation targets or source selection.
- Managed browser preview verified the sample flow, opening collapsed tools from navigation, switching a ready timeframe to a bearish report, fullscreen scanner and keyboard-selected source evidence. This uses fictional sample data and is not a live AI accuracy test.
- Production build and deployment results are recorded in the associated release notes/PR. Native changes are batched in the existing draft; no Apple review submission is replaced.
