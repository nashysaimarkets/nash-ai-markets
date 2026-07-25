/**
 * Customizable desk workspace persistence.
 * Cookie + localStorage fallback — no production migration required.
 */

import {
  DEFAULT_WIDGET_ORDER,
  DESK_WIDGET_IDS,
  isDeskWidgetId,
  type DeskWidgetId,
} from "./desk-widgets.ts";
import { isPreferredPlatformId, type PreferredPlatformId } from "./preferred-platforms.ts";

export const DESK_WORKSPACE_COOKIE = "nash_desk_workspace_v1";
export const DESK_WORKSPACE_STORAGE_KEY = "nash-desk-workspace-v1";
export const DESK_JOURNAL_STORAGE_KEY = "nash-desk-journal-v1";

export type DeskPresetId =
  | "custom"
  | "index-day-trader"
  | "macro"
  | "earnings"
  | "crypto"
  | "volatility";

export type DeskWorkspaceState = {
  version: 1;
  activeMarketId: string;
  favourites: string[];
  widgets: DeskWidgetId[];
  hidden: DeskWidgetId[];
  preset: DeskPresetId;
  focusMode: boolean;
  compareIds: string[];
  preferredPlatformId: PreferredPlatformId;
  externalUrlTemplate: string;
  namedLayouts: Array<{ name: string; widgets: DeskWidgetId[]; favourites: string[] }>;
};

export const DESK_PRESETS: Record<
  Exclude<DeskPresetId, "custom">,
  { label: string; description: string; widgets: DeskWidgetId[]; favourites: string[]; activeMarketId: string }
> = {
  "index-day-trader": {
    label: "Index day trader",
    description: "ES-led chart, structure, session clock, and desk lean.",
    widgets: [
      "freshness-trust",
      "session-clock",
      "quote-overview",
      "preferred-platform",
      "primary-chart",
      "structure-map",
      "edge-brief",
      "desk-signals",
      "watchlist",
      "risk-toolkit",
      "journal-lite",
    ],
    favourites: ["es", "nq", "qqq", "vix", "dxy"],
    activeMarketId: "es",
  },
  macro: {
    label: "Macro desk",
    description: "Rates, dollar, calendar, and catalyst radar.",
    widgets: [
      "freshness-trust",
      "session-clock",
      "quote-overview",
      "preferred-platform",
      "edge-brief",
      "catalyst-radar",
      "economic-calendar",
      "volatility-context",
      "watchlist",
      "compare-rail",
      "journal-lite",
    ],
    favourites: ["es", "us10y", "dxy", "vix", "gold"],
    activeMarketId: "dxy",
  },
  earnings: {
    label: "Earnings watch",
    description: "Shares focus with earnings and news slots.",
    widgets: [
      "freshness-trust",
      "quote-overview",
      "preferred-platform",
      "primary-chart",
      "earnings-calendar",
      "news-intelligence",
      "catalyst-radar",
      "watchlist",
      "risk-toolkit",
      "journal-lite",
    ],
    favourites: ["aapl", "msft", "nvda", "spy", "qqq"],
    activeMarketId: "aapl",
  },
  crypto: {
    label: "Crypto desk",
    description: "Digital-asset favourites with honest coverage labels.",
    widgets: [
      "freshness-trust",
      "quote-overview",
      "preferred-platform",
      "watchlist",
      "news-intelligence",
      "catalyst-radar",
      "risk-toolkit",
      "journal-lite",
    ],
    favourites: ["btc", "eth", "sol", "dxy", "gold"],
    activeMarketId: "btc",
  },
  volatility: {
    label: "Volatility",
    description: "VIX-led context with structure and session timing.",
    widgets: [
      "freshness-trust",
      "session-clock",
      "quote-overview",
      "preferred-platform",
      "primary-chart",
      "volatility-context",
      "structure-map",
      "edge-brief",
      "desk-signals",
      "watchlist",
    ],
    favourites: ["vix", "es", "qqq", "spy"],
    activeMarketId: "vix",
  },
};

export function createDefaultWorkspace(activeMarketId = "es"): DeskWorkspaceState {
  return {
    version: 1,
    activeMarketId,
    favourites: ["es", "nq", "qqq", "vix", "dxy", "oil"],
    widgets: [...DEFAULT_WIDGET_ORDER],
    hidden: ["platform-embed"],
    preset: "index-day-trader",
    focusMode: false,
    compareIds: ["nq", "qqq"],
    preferredPlatformId: "tradingview",
    externalUrlTemplate: "https://www.google.com/search?q={SYMBOL}+stock",
    namedLayouts: [],
  };
}

function uniqueWidgetOrder(ids: unknown): DeskWidgetId[] {
  if (!Array.isArray(ids)) return [...DEFAULT_WIDGET_ORDER];
  const seen = new Set<DeskWidgetId>();
  const order: DeskWidgetId[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !isDeskWidgetId(id) || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  for (const id of DEFAULT_WIDGET_ORDER) {
    if (!seen.has(id)) order.push(id);
  }
  return order;
}

function uniqueIds(ids: unknown, fallback: string[]): string[] {
  if (!Array.isArray(ids)) return [...fallback];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string" || !id.trim() || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length ? out : [...fallback];
}

export function normalizeWorkspace(raw: unknown): DeskWorkspaceState {
  const defaults = createDefaultWorkspace();
  if (!raw || typeof raw !== "object") return defaults;
  const value = raw as Partial<DeskWorkspaceState>;
  const preset = value.preset;
  const validPreset =
    preset === "custom" ||
    preset === "index-day-trader" ||
    preset === "macro" ||
    preset === "earnings" ||
    preset === "crypto" ||
    preset === "volatility"
      ? preset
      : defaults.preset;
  const hidden = Array.isArray(value.hidden)
    ? value.hidden.filter((id): id is DeskWidgetId => typeof id === "string" && isDeskWidgetId(id))
    : [];
  return {
    version: 1,
    activeMarketId: typeof value.activeMarketId === "string" && value.activeMarketId ? value.activeMarketId : defaults.activeMarketId,
    favourites: uniqueIds(value.favourites, defaults.favourites).slice(0, 24),
    widgets: uniqueWidgetOrder(value.widgets),
    hidden,
    preset: validPreset,
    focusMode: Boolean(value.focusMode),
    compareIds: uniqueIds(value.compareIds, defaults.compareIds).slice(0, 3),
    preferredPlatformId:
      typeof value.preferredPlatformId === "string" && isPreferredPlatformId(value.preferredPlatformId)
        ? value.preferredPlatformId
        : defaults.preferredPlatformId,
    externalUrlTemplate:
      typeof value.externalUrlTemplate === "string"
        ? value.externalUrlTemplate.slice(0, 500)
        : defaults.externalUrlTemplate,
    namedLayouts: Array.isArray(value.namedLayouts)
      ? value.namedLayouts
          .filter((layout): layout is { name: string; widgets: DeskWidgetId[]; favourites: string[] } =>
            Boolean(layout) &&
            typeof layout === "object" &&
            typeof (layout as { name?: unknown }).name === "string" &&
            Array.isArray((layout as { widgets?: unknown }).widgets) &&
            Array.isArray((layout as { favourites?: unknown }).favourites),
          )
          .slice(0, 8)
          .map((layout) => ({
            name: layout.name.slice(0, 40),
            widgets: uniqueWidgetOrder(layout.widgets),
            favourites: uniqueIds(layout.favourites, defaults.favourites).slice(0, 24),
          }))
      : [],
  };
}

export function applyPreset(preset: Exclude<DeskPresetId, "custom">): DeskWorkspaceState {
  const base = createDefaultWorkspace();
  const config = DESK_PRESETS[preset];
  return {
    ...base,
    preset,
    activeMarketId: config.activeMarketId,
    favourites: [...config.favourites],
    widgets: [...config.widgets, ...DESK_WIDGET_IDS.filter((id) => !config.widgets.includes(id))],
    hidden: DESK_WIDGET_IDS.filter((id) => !config.widgets.includes(id)),
    focusMode: false,
    compareIds: config.favourites.filter((id) => id !== config.activeMarketId).slice(0, 2),
  };
}

export function parseWorkspaceCookie(raw: string | undefined | null): DeskWorkspaceState | null {
  if (!raw) return null;
  try {
    return normalizeWorkspace(JSON.parse(decodeURIComponent(raw)));
  } catch {
    try {
      return normalizeWorkspace(JSON.parse(raw));
    } catch {
      return null;
    }
  }
}

export function serializeWorkspaceCookie(state: DeskWorkspaceState): string {
  return encodeURIComponent(JSON.stringify(state));
}

export function readWorkspaceFromBrowser(): DeskWorkspaceState {
  if (typeof window === "undefined") return createDefaultWorkspace();
  try {
    const stored = window.localStorage.getItem(DESK_WORKSPACE_STORAGE_KEY);
    if (stored) return normalizeWorkspace(JSON.parse(stored));
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${DESK_WORKSPACE_COOKIE}=([^;]*)`));
  if (match?.[1]) {
    const fromCookie = parseWorkspaceCookie(match[1]);
    if (fromCookie) return fromCookie;
  }
  return createDefaultWorkspace();
}

export function persistWorkspaceToBrowser(state: DeskWorkspaceState): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeWorkspace(state);
  try {
    window.localStorage.setItem(DESK_WORKSPACE_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore quota */
  }
  const value = serializeWorkspaceCookie(normalized);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${DESK_WORKSPACE_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax${secure}`;
}

export type JournalEntry = {
  marketId: string;
  dayKey: string;
  note: string;
  checklist: { label: string; done: boolean }[];
  updatedAt: string;
};

export function journalDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function readJournalMap(): Record<string, JournalEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DESK_JOURNAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, JournalEntry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeJournalEntry(entry: JournalEntry): void {
  if (typeof window === "undefined") return;
  const map = readJournalMap();
  map[`${entry.marketId}:${entry.dayKey}`] = entry;
  try {
    window.localStorage.setItem(DESK_JOURNAL_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function journalKey(marketId: string, dayKey = journalDayKey()): string {
  return `${marketId}:${dayKey}`;
}
