# Product Component Decisions

A product decision for each of the 42 unreferenced components found by
`npm run audit:deadcode`. This supersedes the purely mechanical
`audit-output/CANDIDATE-FOR-REMOVAL.md`, which answers "is it referenced?" but not
"is it worth reviving?".

**No file listed here has been deleted, moved or modified.** Every decision below is a
recommendation requiring explicit approval.

Regenerate the underlying evidence with:

```bash
npm run audit:deadcode   # writes audit-output/candidate-for-removal.json
```

## Decision vocabulary

| Decision | Meaning |
|---|---|
| **Revive** | Real product value, maps to a stated requirement, worth wiring back in |
| **Merge** | The idea is worth keeping, the component is not; fold its strongest part into a live component |
| **Retain dormant** | Do not delete, do not revive yet; blocked on a decision or on data that does not exist |
| **Candidate for removal** | Superseded by a live component; no product value lost |

---

## Revive — components that answer a stated requirement

### `app/components/mini-visuals/*` (7 files, 349 lines) — **Revive as one set**

| File | Lines | Answers |
|---|---|---|
| `RangePositionLane.tsx` | 65 | Where is price within today's range? |
| `BullseyeGauge.tsx` | 98 | How strong is the current reading? |
| `ScenarioPositionLane.tsx` | 45 | Where does price sit between scenarios? |
| `YieldSpreadVisual.tsx` | 43 | Are yields creating pressure? |
| `VolatilityGauge.tsx` | 37 | Is volatility rising or falling? |
| `DxyPressureVisual.tsx` | 36 | Is the dollar supporting or opposing equities? |
| `UnavailableHistory.tsx` | 25 | Honest empty state for the above |

- **Product value:** High. This is the "mini visual system" almost exactly as specified —
  each component answers one question rather than decorating.
- **Data requirements:** VIX, DXY, US10Y and ES candles, all of which the dashboard already
  loads. No new provider work.
- **Equivalent live functionality:** Partial. The command strip shows the same *numbers*,
  but nothing shows *position within a range*, which is the part that needs a visual.
- **Tests affected:** `mini-visuals.test.ts`, `customer-visual-modules.test.ts` already
  cover them and would start covering live code instead of dormant code.
- **CSS dependencies:** Self-contained; no shared class names with live surfaces.
- **Implementation status:** Not started. `UnavailableHistory` should land first so the
  others always have an honest fallback.

### `app/dashboard/components/MarketStructureVisual.tsx` (99 lines) — **Revive**

- **Product value:** High. This is the "key levels map" requirement — a visual ladder of
  overnight high/low, previous close, expected-move boundaries and support/resistance.
- **Data requirements:** All present. `buildDashboardLevels` already computes the levels
  that the live dashboard currently renders as a plain `<ul>`.
- **Equivalent live functionality:** The `.dashLevels` list shows the same values with no
  spatial relationship, so a customer cannot see which level is nearest.
- **Blocking issue:** Needs collision-safe label placement before it ships; overlapping
  labels at narrow widths would be worse than the current list.
- **CSS dependencies:** Uses `dashSection`, shared with live surfaces — keep the styles.

### `app/components/CrossAssetCandleGallery.tsx` (73 lines) — **Revive, scoped**

- **Product value:** Medium-high. Matches the cross-asset context requirement.
- **Data requirements:** This is the constraint. The candles API serves ES only. The
  component must render only instruments with a verified feed and show an honest
  unavailable state for the rest — the same discipline now applied to the command strip.
- **Tests affected:** `cross-asset-candles.test.ts` already exists.

---

## Merge — keep the idea, retire the component

### `app/dashboard/components/TodaysEdge.tsx` (51 lines) — **Merge**

The "what is unusual today" framing is worth keeping and is currently missing. The live
`TodaysGamePlanPanel` is the natural home. Merge the framing, retire the component.

### `app/dashboard/components/DecisionDesk.tsx` (121 lines) — **Merge**

Overlaps heavily with the live posture section in `MarketCommandCentre`. Its stronger idea
is the explicit invalidation line ("what would change this view"), which the live posture
block does not state plainly. Merge that one element.

### `app/dashboard/components/BullseyeMissionControl.tsx` (137 lines) — **Merge**

Superseded as a layout by `MarketCommandCentre`. Its radar-score visual is the only part
worth keeping, and it duplicates `BullseyeGauge` above. Take the gauge, retire the file.

Note: its local `clampScore` is one of the nine near-duplicate clamp implementations
catalogued in the transformation report.

---

## Retain dormant — do not delete, do not revive yet

### `app/chatgpt-auth.ts` (87 lines) — **Retain dormant, escalate separately**

An unreferenced *second authentication path* (`getChatGPTUser`, `requireChatGPTUser`,
`chatGPTSignInPath`, `chatGPTSignOutPath`) dated 2026-07-12 "Add files via upload".

Authentication is on the protected list, so this was not touched and must not be bundled
into a visual or dead-code change. An orphaned auth surface deserves its own decision with
someone who knows why it was added. Flagged, not actioned.

### `app/components/mission-control/MissionControl.tsx` (176 lines) — **Retain dormant**

Large, test-covered, and overlapping with the live command centre. Removing it means
rewriting `bullseye-mission-control.test.ts` and two others. No product value is lost by
leaving it in place, and no risk is taken. Revisit once the mini-visual decision lands.

### `app/lib/oracle/index.ts` — **Retain dormant**

A redundant barrel: every name it re-exports is defined in a sibling module that consumers
import directly. Safe to delete, but deleting it gains nothing and the *modules* are all
live. Low value, non-urgent.

### `db/index.ts` — **Retain dormant**

Only consumer is `examples/d1/app/api/notes/route.ts`, which is starter scaffolding.
Remove only together with `examples/`.

---

## Candidate for removal — superseded, no product value lost

Ordered by size. All are unreferenced by production code.

| File | Lines | Superseded by |
|---|---|---|
| `app/dashboard/components/MarketWeatherPanel.tsx` | 223 | Live weather section in `MarketCommandCentre`; tests already assert it is absent |
| `app/terminal/components/MarketsBrowser.tsx` | 192 | No live markets-browser surface |
| `app/terminal/components/CustomerTerminal.tsx` | 154 | `TradingDeskOS`; tests assert absent |
| `app/dashboard/components/DashboardMarketStatus.tsx` | 114 | Hero + command strip carry the same status |
| `app/dashboard/components/AiMarketOutlook.tsx` | 97 | `AiMarketInsightCard` |
| `app/terminal/components/EliteTradeSetup.tsx` | 92 | `TodaysGamePlanPanel` |
| `app/dashboard/components/MarketIntelligenceStrip.tsx` | 90 | `CommandStrip`; tests assert absent |
| `app/terminal/components/MarketChart.tsx` | 77 | `DashboardCandlestickChart` |
| `app/dashboard/components/EliteOnboardingChecklist.tsx` | 73 | `DailyChecklistPanel` |
| `app/terminal/components/DecisionVerdict.tsx` | 72 | Live posture section |
| `app/dashboard/components/EliteScenarioCard.tsx` | 69 | `OpportunityConditionsPanel` |
| `app/components/PresentationModeToggle.tsx` | 67 | Removed feature; tests assert absent |
| `app/components/AskBullseye.tsx` | 58 | Removed feature; tests assert absent |
| `app/terminal/components/Panel.tsx` | 53 | Per-surface panel styling |
| `app/dashboard/lib/posture-summary.ts` | 48 | `buildTodaysPosture` |
| `app/dashboard/components/DashboardReviewPanel.tsx` | 45 | `SessionReplayPanel` |
| `app/dashboard/components/MorningBriefPanel.tsx` | 44 | The `/brief` route |
| `app/terminal/components/EngineSummary.tsx` | 41 | `ConvictionExplainer` |
| `app/dashboard/components/LiveMarketSummary.tsx` | 40 | `CommandStrip` |
| `app/dashboard/components/HeroMarketChartLazy.tsx` | 31 | Direct import; tests assert absent |
| `app/dashboard/components/EliteConversionPreview.tsx` | 25 | Membership page |
| `app/dashboard/components/BullseyeSignature.tsx` | 24 | Brand mark in `MemberShell` |
| `app/dashboard/components/TodaysBullseyePlan.tsx` | 19 | `TodaysGamePlanPanel` |
| `app/dashboard/components/TradeSetupOfTheDay.tsx` | 18 | `TodaysGamePlanPanel` |
| `app/terminal/components/MetricChip.tsx` | 17 | Inline metric markup |
| `app/dashboard/components/NoTradeScenarioCard.tsx` | 13 | No-trade state in the posture block |

---

## Two rules for whoever executes this

1. **Do not pair component deletion with stylesheet pruning.** Many of these share class
   names with shipping surfaces — `eliteEyebrow`, `terminalPanelEyebrow`, `dashSection`,
   `eliteScenarioIdentity` are all live. Deleting a component does not make its CSS dead.
   Per-file shared-class lists are in `audit-output/candidate-for-removal.json` under
   `cssClassesAlsoUsedElsewhere`.

2. **Removal order.** Tier 1 (no references at all) first, then the tests-assert-absent
   group, and only then anything with live test coverage — those need the test updated
   first. Verify after each group with `npm run lint && npm run typecheck && npm test`.
