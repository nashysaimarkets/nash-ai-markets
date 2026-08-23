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
  /** Structured trust fields — null when not honestly knowable. */
  yesterdayBias: string | null;
  actualOutcome: string | null;
  bullCasePlayed: string | null;
  bearCasePlayed: string | null;
  majorSurprise: string | null;
  lessonLearned: string | null;
  forecastAccuracy: string | null;
  rollingAccuracyNote: string;
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
  const rollingAccuracyNote =
    "Rolling 30-day forecast accuracy appears only once a verified historical scorecard store exists. It is not estimated.";
  const now = input.now ?? Date.now();
  const stats = input.candles?.length ? candleSessionStats(input.candles) : null;
  const ema = input.candles?.length ? exponentialMovingAverage(input.candles, 20).at(-1)?.value ?? null : null;
  const catalysts = upcomingVerifiedEvents(input.snapshot.events, now - 24 * 60 * 60 * 1000, 6);

  if (!stats) {
    return {
      available: false,
      title: "Market replay",
      summaryLines: [],
      limitations: [
        "Verified candle history is insufficient for a factual session replay.",
        "Future verified snapshots can enhance this foundation without inventing history.",
      ],
      primaryActionLabel: "Review today’s session",
      disclosure,
      yesterdayBias: null,
      actualOutcome: null,
      bullCasePlayed: null,
      bearCasePlayed: null,
      majorSurprise: null,
      lessonLearned: null,
      forecastAccuracy: null,
      rollingAccuracyNote,
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
    "Yesterday’s published forecast is not reconstructed here without a verified scorecard archive.",
  ];
  if (!input.verified) limitations.unshift("Decision inputs were incomplete for part of the window.");

  const actualOutcome =
    stats.change > 0
      ? `Net positive across the verified 24-hour window (${stats.change.toFixed(2)} pts).`
      : stats.change < 0
        ? `Net negative across the verified 24-hour window (${stats.change.toFixed(2)} pts).`
        : "Broadly unchanged across the verified 24-hour window.";

  const bullCasePlayed =
    stats.rangePosition >= 65
      ? "Price finished in the upper portion of the verified range — consistent with a constructive tape, not proof of a bull thesis."
      : "Upper-range follow-through was not the dominant verified close location.";
  const bearCasePlayed =
    stats.rangePosition <= 35
      ? "Price finished in the lower portion of the verified range — consistent with pressure, not proof of a bear thesis."
      : "Lower-range follow-through was not the dominant verified close location.";

  return {
    available: true,
    title: "Market replay",
    summaryLines: lines,
    limitations,
    primaryActionLabel: "Review today’s session",
    disclosure,
    yesterdayBias: null,
    actualOutcome,
    bullCasePlayed,
    bearCasePlayed,
    majorSurprise: catalysts[0]
      ? `Nearest listed catalyst context: ${catalysts[0].name}. Surprise magnitude is not scored without a verified event-reaction feed.`
      : "No verified catalyst surprise score is available.",
    lessonLearned:
      "Compare the verified range location and posture with your checklist — score process, not hindsight narrative.",
    forecastAccuracy: null,
    rollingAccuracyNote,
  };
}
