import type { DeskWidgetId } from "./desk-widgets.ts";

export const DESK_VIEW_IDS = ["overview", "charts", "catalysts", "risk"] as const;
export type DeskViewId = (typeof DESK_VIEW_IDS)[number];

export const DESK_VIEW_LABELS: Record<DeskViewId, string> = {
  overview: "Overview",
  charts: "Charts",
  catalysts: "Catalysts",
  risk: "Risk & Journal",
};

/** Widgets shown inside non-overview desk views (Overview uses a fixed composition). */
export const DESK_VIEW_WIDGETS: Record<Exclude<DeskViewId, "overview">, DeskWidgetId[]> = {
  charts: [
    "primary-chart",
    "structure-map",
    "compare-rail",
    "volatility-context",
    "platform-embed",
    "watchlist",
  ],
  catalysts: [
    "catalyst-radar",
    "economic-calendar",
    "earnings-calendar",
    "news-intelligence",
  ],
  risk: [
    "risk-toolkit",
    "journal-lite",
    "preferred-platform",
    "freshness-trust",
    "session-clock",
  ],
};

export const DESK_VIEW_STORAGE_KEY = "nash-desk-view-v1";
export const DESK_MARKETS_COLLAPSED_KEY = "nash-desk-markets-collapsed-v1";

export function isDeskViewId(value: string): value is DeskViewId {
  return (DESK_VIEW_IDS as readonly string[]).includes(value);
}

export function widgetsForView(
  view: DeskViewId,
  visible: DeskWidgetId[],
): DeskWidgetId[] {
  if (view === "overview") return [];
  const allowed = new Set(DESK_VIEW_WIDGETS[view]);
  return visible.filter((id) => allowed.has(id));
}
