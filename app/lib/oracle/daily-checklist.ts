import { notifyOracleStorage } from "./oracle-storage-bus.ts";

export const CHECKLIST_STORAGE_KEY = "nash-oracle-checklist-v1";

export type ChecklistItemId =
  | "overnight"
  | "events"
  | "levels"
  | "max-risk"
  | "thesis"
  | "no-trade"
  | "journal"
  | "review";

export type ChecklistItem = {
  id: ChecklistItemId;
  label: string;
  done: boolean;
};

export type DailyChecklistState = {
  version: 1;
  dayKey: string;
  items: Record<ChecklistItemId, boolean>;
};

export type DailyChecklistModel = {
  dayKey: string;
  items: ChecklistItem[];
  completed: number;
  total: number;
  coachingNote: string;
};

const LABELS: Record<ChecklistItemId, string> = {
  overnight: "Reviewed overnight conditions",
  events: "Checked today’s economic events",
  levels: "Reviewed verified market levels",
  "max-risk": "Defined maximum acceptable risk",
  thesis: "Written a trade thesis",
  "no-trade": "Defined no-trade conditions",
  journal: "Journal ready",
  review: "Post-session review completed",
};

const ORDER: ChecklistItemId[] = [
  "overnight",
  "events",
  "levels",
  "max-risk",
  "thesis",
  "no-trade",
  "journal",
  "review",
];

export function tradingDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function emptyItems(): Record<ChecklistItemId, boolean> {
  return {
    overnight: false,
    events: false,
    levels: false,
    "max-risk": false,
    thesis: false,
    "no-trade": false,
    journal: false,
    review: false,
  };
}

export function coachingNoteFor(input: {
  postureHeadline: string;
  permissionTone: string;
  hasUpcomingEvent: boolean;
  completedPrep: number;
}): string {
  if (/blocked|restricted|caution/i.test(input.permissionTone) && input.completedPrep < 4) {
    return "Confirmation remains incomplete. Protect capital and wait for clearer evidence.";
  }
  if (input.hasUpcomingEvent) {
    return "Event risk is approaching. Avoid increasing exposure solely from recent price movement.";
  }
  if (input.completedPrep < 5) {
    return "Your plan is incomplete. Define risk and no-trade conditions before considering participation.";
  }
  if (/patient|restricted/i.test(input.postureHeadline)) {
    return "Conditions may look quieter, but quiet is not the same as confirmed.";
  }
  return "Conditions can look supportive, but supportive is not the same as guaranteed.";
}

export function buildDailyChecklist(
  state: DailyChecklistState | null,
  coaching: {
    postureHeadline: string;
    permissionTone: string;
    hasUpcomingEvent: boolean;
  },
  now = new Date(),
): DailyChecklistModel {
  const dayKey = tradingDayKey(now);
  const itemsMap = state && state.dayKey === dayKey ? state.items : emptyItems();
  const items = ORDER.map((id) => ({ id, label: LABELS[id], done: Boolean(itemsMap[id]) }));
  const completed = items.filter((item) => item.done).length;
  return {
    dayKey,
    items,
    completed,
    total: items.length,
    coachingNote: coachingNoteFor({
      ...coaching,
      completedPrep: completed,
    }),
  };
}

export function readDailyChecklist(
  storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
  now = new Date(),
): DailyChecklistState {
  const dayKey = tradingDayKey(now);
  const fallback: DailyChecklistState = { version: 1, dayKey, items: emptyItems() };
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<DailyChecklistState>;
    if (parsed.version !== 1 || typeof parsed.dayKey !== "string" || !parsed.items) return fallback;
    if (parsed.dayKey !== dayKey) return fallback;
    return {
      version: 1,
      dayKey,
      items: { ...emptyItems(), ...parsed.items },
    };
  } catch {
    return fallback;
  }
}

export function writeDailyChecklist(
  state: DailyChecklistState,
  storage: Pick<Storage, "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): void {
  if (!storage) return;
  try {
    storage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state));
    notifyOracleStorage();
  } catch {
    // ignore
  }
}

export function resetDailyChecklist(
  storage: Pick<Storage, "setItem" | "removeItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
  now = new Date(),
): DailyChecklistState {
  const next: DailyChecklistState = { version: 1, dayKey: tradingDayKey(now), items: emptyItems() };
  writeDailyChecklist(next, storage);
  return next;
}
