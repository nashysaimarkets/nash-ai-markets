/**
 * Session Command Strip — published US equity RTH / overnight context.
 * Uses America/New_York wall-clock rules only. No fake exchange clocks.
 */

export type SessionPhase = "premarket" | "rth" | "afterhours" | "weekend" | "holiday-closed";

export type SessionClockReading = {
  phase: SessionPhase;
  label: string;
  detail: string;
  countdownLabel: string | null;
  countdownMs: number | null;
  nowEt: string;
  nextEventLabel: string | null;
  source: string;
};

const SOURCE =
  "US equity regular session 09:30–16:00 America/New_York on weekdays. Premarket 04:00–09:30; after-hours 16:00–20:00. Holidays are not auto-detected — treat as educational timing only.";

function etParts(now: Date): { weekday: number; hour: number; minute: number; second: number; label: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdayMap[get("weekday")] ?? now.getUTCDay();
  return {
    weekday,
    hour: Number.parseInt(get("hour"), 10) || 0,
    minute: Number.parseInt(get("minute"), 10) || 0,
    second: Number.parseInt(get("second"), 10) || 0,
    label: new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    }).format(now),
  };
}

function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

/**
 * Approximate ms until a target ET clock time on the same or next weekday session.
 * Does not invent holiday calendars — weekends jump to Monday 04:00 ET premarket.
 */
function msUntilEtClock(now: Date, targetHour: number, targetMinute: number, allowNextWeekday = true): number {
  const et = etParts(now);
  const nowMinutes = minutesOfDay(et.hour, et.minute) + et.second / 60;
  const targetMinutes = minutesOfDay(targetHour, targetMinute);
  let dayOffset = 0;
  if (et.weekday === 0) dayOffset = 1;
  else if (et.weekday === 6) dayOffset = 2;
  else if (nowMinutes >= targetMinutes) {
    if (!allowNextWeekday) return 0;
    dayOffset = et.weekday === 5 ? 3 : 1;
  }
  const remainingToday = (targetMinutes - nowMinutes) * 60_000;
  if (dayOffset === 0) return Math.max(0, remainingToday);
  const minutesLeftToday = (24 * 60 - nowMinutes) * 60_000;
  const fullDays = Math.max(0, dayOffset - 1) * 24 * 60 * 60_000;
  return minutesLeftToday + fullDays + targetMinutes * 60_000;
}

export function readSessionClock(now = new Date()): SessionClockReading {
  const et = etParts(now);
  const mins = minutesOfDay(et.hour, et.minute);

  if (et.weekday === 0 || et.weekday === 6) {
    const countdownMs = msUntilEtClock(now, 4, 0);
    return {
      phase: "weekend",
      label: "Weekend",
      detail: "US equity cash session is closed for the weekend.",
      countdownLabel: formatCountdown(countdownMs),
      countdownMs,
      nowEt: et.label,
      nextEventLabel: "Next premarket open (Mon 04:00 ET)",
      source: SOURCE,
    };
  }

  if (mins < minutesOfDay(4, 0)) {
    const countdownMs = msUntilEtClock(now, 4, 0, false);
    return {
      phase: "afterhours",
      label: "Overnight",
      detail: "Between after-hours close and premarket open.",
      countdownLabel: formatCountdown(countdownMs),
      countdownMs,
      nowEt: et.label,
      nextEventLabel: "Premarket opens 04:00 ET",
      source: SOURCE,
    };
  }

  if (mins < minutesOfDay(9, 30)) {
    const countdownMs = msUntilEtClock(now, 9, 30, false);
    return {
      phase: "premarket",
      label: "Premarket",
      detail: "US equity premarket window (04:00–09:30 ET).",
      countdownLabel: formatCountdown(countdownMs),
      countdownMs,
      nowEt: et.label,
      nextEventLabel: "Regular session opens 09:30 ET",
      source: SOURCE,
    };
  }

  if (mins < minutesOfDay(16, 0)) {
    const countdownMs = msUntilEtClock(now, 16, 0, false);
    return {
      phase: "rth",
      label: "Regular hours",
      detail: "US equity regular trading hours (09:30–16:00 ET).",
      countdownLabel: formatCountdown(countdownMs),
      countdownMs,
      nowEt: et.label,
      nextEventLabel: "Regular session closes 16:00 ET",
      source: SOURCE,
    };
  }

  if (mins < minutesOfDay(20, 0)) {
    const countdownMs = msUntilEtClock(now, 20, 0, false);
    return {
      phase: "afterhours",
      label: "After hours",
      detail: "US equity after-hours window (16:00–20:00 ET).",
      countdownLabel: formatCountdown(countdownMs),
      countdownMs,
      nowEt: et.label,
      nextEventLabel: "After-hours ends 20:00 ET",
      source: SOURCE,
    };
  }

  const countdownMs = msUntilEtClock(now, 4, 0);
  return {
    phase: "afterhours",
    label: "Overnight",
    detail: "US equity cash session closed until premarket.",
    countdownLabel: formatCountdown(countdownMs),
    countdownMs,
    nowEt: et.label,
    nextEventLabel: "Premarket opens 04:00 ET",
    source: SOURCE,
  };
}
