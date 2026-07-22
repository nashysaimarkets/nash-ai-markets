# Workflow entitlement matrix (proposed)

This matrix mirrors `FEATURE_TIER` in `app/terminal/lib/membership-entitlement.ts`. Preview claims can temporarily raise Free→Pro (weekly) or Pro→Elite (daily); effective tier then unlocks the higher feature set for that period.

| Workflow surface | Feature key | Free | Pro | Elite | Notes |
| --- | --- | --- | --- | --- | --- |
| Market overview / dashboard core | `market-overview` | Yes | Yes | Yes | Baseline member workspace |
| Market intelligence panels | `intelligence` | — | Yes | Yes | Includes AI brief prioritisation when configured |
| Decision engine panels | `decision-engine` | — | Yes | Yes | Bias, permission, risk, conflicts |
| Structured trade planner | `trade-planner` | — | — | Yes | Full participation framework |
| Launch diagnostics | `launch-diagnostics` | — | — | Yes | Operator diagnostics |
| Yesterday’s Review | `yesterday-review` | — | Yes | Yes | Stored previous-day snapshot only |
| Historical archive | `archive` | — | Yes | Yes | List + day detail from snapshots |
| Options Corner | `options-corner` | — | Yes | Yes | Underlying framework; chain withheld without provider |
| Trade journal | `journal` | — | Yes | Yes | Private entries; migration-pending empty state |
| Journal performance | `performance` | — | Yes | Yes | Requires ≥5 closed P&L rows before percentages |
| Results Centre | `results-centre` | — | — | Yes | Snapshot aggregates only; no fabricated accuracy |
| Bullseye Replay Beta | `replay` | — | — | Yes | Stored plan + timestamps; no invented candles |
| Methodology (education) | _(authenticated)_ | Yes | Yes | Yes | Always available to signed-in members |

## Integrity rules (all tiers)

- Never invent market data, prices, strikes, Greeks, candle series or historical plans.
- Missing tables → polished migration-pending / unavailable states.
- Stored review surfaces must not re-run engines and present the output as the “original.”
- Results and performance withhold percentages until sample gates are met.
