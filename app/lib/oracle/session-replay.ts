import type { MarketSnapshot } from "../market-data.ts";
import type { TradingDecision } from "../trading-decision-engine.ts";
import type { DeskDecisionPresentation } from "../../terminal/lib/desk-decision-presentation.ts";
import { candleSessionStats, exponentialMovingAverage } from "../../dashboard/lib/candle-analysis.ts";
import type { OhlcvPoint } from "../../terminal/lib/visual-terminal.ts";
import { upcomingVerifiedEvents, formatVerifiedEventWhen, eventTimestampMs } from "../../terminal/lib/event-display.ts";

export type SessionReplayModel = {
  available: boolean;
  title: string;
  summaryLines: string[];
  limitations: string[];
  primaryActionLabel: string;
  disclosure: string;
};

export function buildSessionReplay(input: {
  snapshot: MarketSnapshot;
  decision: TradingDecision;
  presentation: DeskDecisionPresentation;
  candles?: OhlcvPoint[] | null;
  verified: boolean;
  now?: number;
}): SessionReplayModel {
  const disclosure =
    "Factual session foundation from verified delayed candles and calendar rows. Coincidences are not causes. Not a full historical intelligence replay.";
  const now = input.now ?? Date.now();
  const stats = input.candles?.length ? candleSessionStats(input.candles) : null;
  const ema = input.candles?.length ? exponentialMovingAverage(input.candles, 20).at(-1)?.value ?? null : null;
  const catalysts = upcomingVerifiedEvents(input.snapshot.events, now - 24 * 60 * 60 * 1000, 6);

  if (!stats) {
    return {
      available: false,
      title: "Session replay foundation",
      summaryLines: [],
      limitations: [
        "Verified candle history is insufficient for a factual session replay.",
        "Future verified snapshots can enhance this foundation without inventing history.",
      ],
      primaryActionLabel: "Review today’s session",
      disclosure,
    };
  }

  const lines: string[] = [
    `Verified 24-hour high ${stats.high.toFixed(2)} and low ${stats.low.toFixed(2)}.`,
    `Latest verified close ${stats.latest.toFixed(2)} sits ${stats.rangePosition >= 50 ? "in the upper half" : "in the lower half"} of that range.`,
  ];
  if (ema != null) {
    lines.push(`Close is ${stats.latest >= ema ? "at or above" : "below"} the verified 20 EMA (${ema.toFixed(2)}).`);
  }
  lines.push(`Final observed posture: ${input.presentation.permissionLabel} · ${input.presentation.leanLabel}.`);

  const vix = input.snapshot.quotes.find((item) => item.symbol === "VIX");
  const dxy = input.snapshot.quotes.find((item) => item.symbol === "DXY");
  if (vix) lines.push(`Volatility context coincided with VIX ${vix.direction} at ${vix.value}.`);
  if (dxy) lines.push(`Dollar context coincided with DXY ${dxy.direction} at ${dxy.value}.`);

  for (const event of catalysts.slice(0, 2)) {
    const stamp = eventTimestampMs(event);
    lines.push(
      `Verified catalyst listed: ${event.name}${stamp != null ? ` · ${formatVerifiedEventWhen(stamp)}` : ""}.`,
    );
  }

  const limitations = [
    "This foundation does not reconstruct a full tick-by-tick narrative.",
    "Causal explanations are withheld unless a verified source supports them.",
  ];
  if (!input.verified) limitations.unshift("Decision inputs were incomplete for part of the window.");

  return {
    available: true,
    title: "Session replay foundation",
    summaryLines: lines,
    limitations,
    primaryActionLabel: "Review today’s session",
    disclosure,
  };
}
