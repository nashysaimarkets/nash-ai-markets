import type { OhlcvPoint } from "../../terminal/lib/visual-terminal.ts";

/**
 * Educational session reference levels derived only from verified OHLCV candles.
 * Uses America/New_York wall-clock RTH (09:30–16:00). Fail-closed when history is thin.
 */

export type SessionReferenceLevels = {
  previousDayHigh: number | null;
  previousDayLow: number | null;
  overnightHigh: number | null;
  overnightLow: number | null;
  todaysOpen: number | null;
  source: string;
};

const SOURCE =
  "Derived from verified OHLCV using America/New_York RTH 09:30–16:00. Educational desk levels — not exchange official prints.";

function etParts(unixSeconds: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(new Date(unixSeconds * 1000));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: get("weekday"),
    dayKey: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function isWeekday(weekday: string) {
  return weekday !== "Sat" && weekday !== "Sun";
}

function inRth(minutes: number) {
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

function highLow(candles: OhlcvPoint[]) {
  if (!candles.length) return null;
  return {
    high: Math.max(...candles.map((c) => c.high)),
    low: Math.min(...candles.map((c) => c.low)),
  };
}

export function deriveSessionReferenceLevels(
  candles: OhlcvPoint[],
  nowUnixSeconds = Math.floor(Date.now() / 1000),
): SessionReferenceLevels {
  const empty: SessionReferenceLevels = {
    previousDayHigh: null,
    previousDayLow: null,
    overnightHigh: null,
    overnightLow: null,
    todaysOpen: null,
    source: SOURCE,
  };
  if (!candles.length) return empty;

  const ordered = [...candles].sort((a, b) => a.time - b.time);
  const nowEt = etParts(nowUnixSeconds);
  const todayKey = nowEt.dayKey;

  const byDay = new Map<string, OhlcvPoint[]>();
  for (const candle of ordered) {
    const et = etParts(candle.time);
    if (!isWeekday(et.weekday)) continue;
    const list = byDay.get(et.dayKey) ?? [];
    list.push(candle);
    byDay.set(et.dayKey, list);
  }

  const weekdayKeys = [...byDay.keys()].sort();
  const priorKeys = weekdayKeys.filter((key) => key < todayKey);
  const priorKey = priorKeys.at(-1) ?? null;

  let previousDayHigh: number | null = null;
  let previousDayLow: number | null = null;
  if (priorKey) {
    const priorRth = (byDay.get(priorKey) ?? []).filter((candle) => inRth(etParts(candle.time).minutes));
    const range = highLow(priorRth);
    if (range) {
      previousDayHigh = range.high;
      previousDayLow = range.low;
    }
  }

  const overnight = ordered.filter((candle) => {
    const et = etParts(candle.time);
    if (priorKey && et.dayKey === priorKey && et.minutes >= 16 * 60) return true;
    if (et.dayKey === todayKey && et.minutes < 9 * 60 + 30) return true;
    return false;
  });
  const overnightRange = highLow(overnight);

  let todaysOpen: number | null = null;
  const todayCandles = byDay.get(todayKey) ?? [];
  const rthOpen = todayCandles.find((candle) => etParts(candle.time).minutes >= 9 * 60 + 30);
  if (rthOpen) todaysOpen = rthOpen.open;
  else if (todayCandles[0]) todaysOpen = todayCandles[0].open;

  return {
    previousDayHigh,
    previousDayLow,
    overnightHigh: overnightRange?.high ?? null,
    overnightLow: overnightRange?.low ?? null,
    todaysOpen,
    source: SOURCE,
  };
}

export function sessionStatusLabel(phase: string): "OPEN" | "PRE-MARKET" | "POST-MARKET" | "CLOSED" {
  switch (phase) {
    case "rth":
      return "OPEN";
    case "premarket":
      return "PRE-MARKET";
    case "afterhours":
      return "POST-MARKET";
    default:
      return "CLOSED";
  }
}
