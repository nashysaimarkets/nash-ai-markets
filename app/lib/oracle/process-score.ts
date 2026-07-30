import { tradingDayKey, type ChecklistItemId } from "./daily-checklist.ts";
import { notifyOracleStorage } from "./oracle-storage-bus.ts";

export const PROCESS_SCORE_STORAGE_KEY = "nash-oracle-process-v1";

export type ProcessScoreState = {
  version: 1;
  days: Record<
    string,
    {
      checklistComplete: boolean;
      planComplete: boolean;
      noTradeDocumented: boolean;
      sessionReviewed: boolean;
      journalCompleted: boolean;
    }
  >;
};

export type ProcessScoreModel = {
  preparedToday: boolean;
  consecutivePreparedSessions: number;
  completionRateLabel: string;
  emphasis: string;
  disclosure: string;
};

function emptyDay() {
  return {
    checklistComplete: false,
    planComplete: false,
    noTradeDocumented: false,
    sessionReviewed: false,
    journalCompleted: false,
  };
}

export function readProcessScore(
  storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): ProcessScoreState {
  const fallback: ProcessScoreState = { version: 1, days: {} };
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(PROCESS_SCORE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ProcessScoreState>;
    if (parsed.version !== 1 || !parsed.days || typeof parsed.days !== "object") return fallback;
    return { version: 1, days: parsed.days };
  } catch {
    return fallback;
  }
}

export function writeProcessScore(
  state: ProcessScoreState,
  storage: Pick<Storage, "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): void {
  if (!storage) return;
  try {
    storage.setItem(PROCESS_SCORE_STORAGE_KEY, JSON.stringify(state));
    notifyOracleStorage();
  } catch {
    // ignore
  }
}

export function clearProcessScore(
  storage: Pick<Storage, "removeItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): void {
  if (!storage) return;
  try {
    storage.removeItem(PROCESS_SCORE_STORAGE_KEY);
    notifyOracleStorage();
  } catch {
    // ignore
  }
}

export function syncProcessScoreFromChecklist(
  checklist: Record<ChecklistItemId, boolean>,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
  now = new Date(),
): ProcessScoreState {
  const state = readProcessScore(storage);
  const dayKey = tradingDayKey(now);
  const day = state.days[dayKey] ?? emptyDay();
  day.checklistComplete = Object.values(checklist).filter(Boolean).length >= 6;
  day.planComplete = Boolean(checklist.thesis && checklist["max-risk"]);
  day.noTradeDocumented = Boolean(checklist["no-trade"]);
  day.sessionReviewed = Boolean(checklist.review);
  day.journalCompleted = Boolean(checklist.journal);
  state.days[dayKey] = day;
  writeProcessScore(state, storage);
  return state;
}

function isPrepared(day: ProcessScoreState["days"][string] | undefined): boolean {
  if (!day) return false;
  return day.checklistComplete && day.planComplete && day.noTradeDocumented;
}

export function buildProcessScore(state: ProcessScoreState, now = new Date()): ProcessScoreModel {
  const dayKey = tradingDayKey(now);
  const days = Object.keys(state.days).sort();
  const preparedDays = days.filter((key) => isPrepared(state.days[key]));
  let consecutive = 0;
  const cursor = new Date(now);
  for (let i = 0; i < 14; i += 1) {
    const key = tradingDayKey(cursor);
    if (isPrepared(state.days[key])) consecutive += 1;
    else break;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  const rate = days.length ? Math.round((preparedDays.length / days.length) * 100) : 0;
  return {
    preparedToday: isPrepared(state.days[dayKey]),
    consecutivePreparedSessions: consecutive,
    completionRateLabel: days.length ? `${rate}% of tracked sessions show completed preparation` : "No prepared sessions tracked yet",
    emphasis: "Process consistency tracks preparation and review — never trade count, size or P&L.",
    disclosure: "Local process summary only. Not investment performance and not stored on the server.",
  };
}
