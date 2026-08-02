import type { SessionClockReading } from "../../terminal/lib/session-clock.ts";
import { readSessionClock } from "../../terminal/lib/session-clock.ts";

export type SessionStageId =
  | "overnight"
  | "premarket"
  | "opening-auction"
  | "morning"
  | "midday"
  | "afternoon"
  | "power-hour"
  | "post-close";

export type SessionTimelineStage = {
  id: SessionStageId;
  label: string;
  focus: string;
  active: boolean;
};

export type SessionTimelineModel = {
  current: SessionStageId;
  currentLabel: string;
  nextLabel: string | null;
  countdownLabel: string | null;
  nowEt: string;
  focus: string;
  stages: SessionTimelineStage[];
  source: string;
  disclosure: string;
};

const FOCUS: Record<SessionStageId, string> = {
  overnight: "Review overnight prints and prepare the session plan without forcing participation.",
  premarket: "Map verified levels and catalysts before cash-session liquidity arrives.",
  "opening-auction": "Allow initial volatility to settle and watch behaviour around verified opening references.",
  morning: "Observe whether the opening lean continues with confirmation from volatility and the dollar.",
  midday: "Expect reduced participation unless a catalyst changes conditions.",
  afternoon: "Watch whether the morning structure holds as liquidity returns.",
  "power-hour": "Watch whether the day’s trend strengthens, fades or remains balanced.",
  "post-close": "Capture the session review: range location, catalysts and process notes.",
};

function minutesEt(now: Date): { weekday: number; mins: number; label: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: map[get("weekday")] ?? now.getUTCDay(),
    mins: (Number.parseInt(get("hour"), 10) || 0) * 60 + (Number.parseInt(get("minute"), 10) || 0),
    label: new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(now),
  };
}

function resolveStage(now: Date, clock: SessionClockReading): SessionStageId {
  if (clock.phase === "weekend" || clock.phase === "holiday-closed") return "post-close";
  const { mins } = minutesEt(now);
  if (mins < 4 * 60) return "overnight";
  if (mins < 9 * 60 + 30) return "premarket";
  if (mins < 9 * 60 + 45) return "opening-auction";
  if (mins < 11 * 60 + 30) return "morning";
  if (mins < 14 * 60) return "midday";
  if (mins < 15 * 60) return "afternoon";
  if (mins < 16 * 60) return "power-hour";
  return "post-close";
}

const ORDER: SessionStageId[] = [
  "overnight",
  "premarket",
  "opening-auction",
  "morning",
  "midday",
  "afternoon",
  "power-hour",
  "post-close",
];

const LABELS: Record<SessionStageId, string> = {
  overnight: "Overnight",
  premarket: "Pre-market",
  "opening-auction": "Opening auction",
  morning: "Morning session",
  midday: "Midday",
  afternoon: "Afternoon session",
  "power-hour": "Power hour",
  "post-close": "Post-close",
};

export function buildSessionTimeline(now = new Date()): SessionTimelineModel {
  const clock = readSessionClock(now);
  const current = resolveStage(now, clock);
  const index = ORDER.indexOf(current);
  const next = index >= 0 && index < ORDER.length - 1 ? ORDER[index + 1]! : null;

  return {
    current,
    currentLabel: LABELS[current],
    nextLabel: next ? LABELS[next] : clock.nextEventLabel,
    countdownLabel: clock.countdownLabel,
    nowEt: clock.nowEt,
    focus: FOCUS[current],
    stages: ORDER.map((id) => ({
      id,
      label: LABELS[id],
      focus: FOCUS[id],
      active: id === current,
    })),
    source: clock.source,
    disclosure:
      "US equity session stages are educational timing aids from America/New_York wall-clock rules. Holidays are not auto-detected and no stage guarantees market behaviour.",
  };
}
