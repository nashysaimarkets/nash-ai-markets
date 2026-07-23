/**
 * Loadable widget registry for the personal trading workspace.
 * Layout is data-driven (order + size); components render empty/unavailable honestly.
 */

export type WorkspaceWidgetId =
  | "primary_chart"
  | "watchlist"
  | "instrument_cards"
  | "heatmap"
  | "news"
  | "economic_calendar"
  | "earnings_calendar"
  | "volatility_monitor"
  | "vix_gauge"
  | "treasury_monitor"
  | "usd_monitor"
  | "sector_performance"
  | "market_breadth"
  | "support_resistance"
  | "expected_move"
  | "session_clock"
  | "opening_range"
  | "notes"
  | "checklist"
  | "position_size"
  | "risk_reward"
  | "journal"
  | "alerts"
  | "ai_assistant"
  | "market_review"
  | "historical_context";

export type WidgetSize = "sm" | "md" | "lg" | "xl";

export type WidgetDefinition = {
  id: WorkspaceWidgetId;
  title: string;
  description: string;
  defaultSize: WidgetSize;
  /** When false, widget always shows an explicit unavailable / placeholder state. */
  dataReady: boolean;
  unavailableCopy: string | null;
  mobilePriority: number;
};

export type WidgetLayoutItem = {
  id: WorkspaceWidgetId;
  size: WidgetSize;
  enabled: boolean;
};

export const WORKSPACE_WIDGETS: readonly WidgetDefinition[] = [
  {
    id: "primary_chart",
    title: "Primary chart",
    description: "Verified candlesticks for the active market.",
    defaultSize: "xl",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 1,
  },
  {
    id: "market_review",
    title: "Market review",
    description: "Plain-English review from verified desk signals only.",
    defaultSize: "lg",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 2,
  },
  {
    id: "watchlist",
    title: "Watchlist",
    description: "Your favourite markets with verified quotes when available.",
    defaultSize: "md",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 3,
  },
  {
    id: "instrument_cards",
    title: "Instrument cards",
    description: "Compact cards for favourites on your desk.",
    defaultSize: "md",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 4,
  },
  {
    id: "news",
    title: "News intelligence",
    description: "Market-specific headlines from a verified news provider.",
    defaultSize: "md",
    dataReady: false,
    unavailableCopy: "Verified news feed is not configured for this environment.",
    mobilePriority: 8,
  },
  {
    id: "economic_calendar",
    title: "Economic calendar",
    description: "Verified macro events with countdown and importance.",
    defaultSize: "md",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 6,
  },
  {
    id: "earnings_calendar",
    title: "Earnings calendar",
    description: "Company earnings relevant to your favourites.",
    defaultSize: "md",
    dataReady: false,
    unavailableCopy: "Verified earnings calendar is not yet connected.",
    mobilePriority: 9,
  },
  {
    id: "volatility_monitor",
    title: "Volatility monitor",
    description: "VIX and related volatility context when verified.",
    defaultSize: "sm",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 7,
  },
  {
    id: "vix_gauge",
    title: "VIX gauge",
    description: "Verified VIX level with freshness.",
    defaultSize: "sm",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 10,
  },
  {
    id: "treasury_monitor",
    title: "Treasury monitor",
    description: "US 2-year and 10-year yields when verified.",
    defaultSize: "sm",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 11,
  },
  {
    id: "usd_monitor",
    title: "USD monitor",
    description: "US Dollar Index when verified.",
    defaultSize: "sm",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 12,
  },
  {
    id: "support_resistance",
    title: "Support & resistance",
    description: "Structure levels derived from verified candles.",
    defaultSize: "md",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 5,
  },
  {
    id: "historical_context",
    title: "Historical context",
    description: "Context from candle history — not predictions.",
    defaultSize: "md",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 13,
  },
  {
    id: "session_clock",
    title: "Session clock",
    description: "UK session clock for planning.",
    defaultSize: "sm",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 14,
  },
  {
    id: "expected_move",
    title: "Expected move",
    description: "Expected-move estimates only when verified inputs exist.",
    defaultSize: "sm",
    dataReady: false,
    unavailableCopy: "Expected-move estimates require verified options inputs that are not configured.",
    mobilePriority: 15,
  },
  {
    id: "heatmap",
    title: "Heatmap",
    description: "Cross-asset pressure heatmap.",
    defaultSize: "md",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 16,
  },
  {
    id: "sector_performance",
    title: "Sector performance",
    description: "Sector performance from a verified provider.",
    defaultSize: "md",
    dataReady: false,
    unavailableCopy: "Sector performance data is awaiting verified provider coverage.",
    mobilePriority: 17,
  },
  {
    id: "market_breadth",
    title: "Market breadth",
    description: "Breadth indicators when provider coverage exists.",
    defaultSize: "sm",
    dataReady: false,
    unavailableCopy: "Market breadth data is awaiting verified provider coverage.",
    mobilePriority: 18,
  },
  {
    id: "opening_range",
    title: "Opening range",
    description: "Opening-range levels from verified session candles.",
    defaultSize: "sm",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 19,
  },
  {
    id: "notes",
    title: "Notes",
    description: "Personal desk notes (local to your workspace prefs).",
    defaultSize: "sm",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 20,
  },
  {
    id: "checklist",
    title: "Checklist",
    description: "Pre-trade checklist — educational only.",
    defaultSize: "sm",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 21,
  },
  {
    id: "position_size",
    title: "Position size",
    description: "Simple position-size calculator from your inputs.",
    defaultSize: "sm",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 22,
  },
  {
    id: "risk_reward",
    title: "Risk / reward",
    description: "R:R calculator from your entry, stop and target.",
    defaultSize: "sm",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 23,
  },
  {
    id: "journal",
    title: "Journal",
    description: "Shortcut into your trade journal.",
    defaultSize: "sm",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 24,
  },
  {
    id: "alerts",
    title: "Alerts",
    description: "Price alerts placeholder.",
    defaultSize: "sm",
    dataReady: false,
    unavailableCopy: "Alerts are not available yet. Your desk remains fully usable without them.",
    mobilePriority: 25,
  },
  {
    id: "ai_assistant",
    title: "AI market assistant",
    description: "Ask Bullseye using verified desk context.",
    defaultSize: "md",
    dataReady: true,
    unavailableCopy: null,
    mobilePriority: 26,
  },
] as const;

const WIDGET_BY_ID = new Map(WORKSPACE_WIDGETS.map((widget) => [widget.id, widget]));

export function getWidgetDefinition(id: string): WidgetDefinition | null {
  return WIDGET_BY_ID.get(id as WorkspaceWidgetId) ?? null;
}

export function isWorkspaceWidgetId(value: string): value is WorkspaceWidgetId {
  return WIDGET_BY_ID.has(value as WorkspaceWidgetId);
}

export const DEFAULT_WIDGET_LAYOUT: WidgetLayoutItem[] = [
  { id: "primary_chart", size: "xl", enabled: true },
  { id: "market_review", size: "lg", enabled: true },
  { id: "watchlist", size: "md", enabled: true },
  { id: "instrument_cards", size: "md", enabled: true },
  { id: "support_resistance", size: "md", enabled: true },
  { id: "economic_calendar", size: "md", enabled: true },
  { id: "news", size: "md", enabled: true },
  { id: "volatility_monitor", size: "sm", enabled: true },
  { id: "vix_gauge", size: "sm", enabled: true },
  { id: "treasury_monitor", size: "sm", enabled: true },
  { id: "usd_monitor", size: "sm", enabled: true },
  { id: "historical_context", size: "md", enabled: true },
  { id: "session_clock", size: "sm", enabled: true },
  { id: "ai_assistant", size: "md", enabled: true },
  { id: "earnings_calendar", size: "md", enabled: false },
  { id: "heatmap", size: "md", enabled: false },
  { id: "notes", size: "sm", enabled: false },
  { id: "checklist", size: "sm", enabled: false },
  { id: "position_size", size: "sm", enabled: false },
  { id: "risk_reward", size: "sm", enabled: false },
  { id: "journal", size: "sm", enabled: false },
  { id: "alerts", size: "sm", enabled: false },
  { id: "expected_move", size: "sm", enabled: false },
  { id: "opening_range", size: "sm", enabled: false },
  { id: "sector_performance", size: "md", enabled: false },
  { id: "market_breadth", size: "sm", enabled: false },
];

export function normalizeWidgetLayout(value: unknown): WidgetLayoutItem[] {
  if (!Array.isArray(value)) return DEFAULT_WIDGET_LAYOUT.map((item) => ({ ...item }));
  const seen = new Set<WorkspaceWidgetId>();
  const items: WidgetLayoutItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== "string" || !isWorkspaceWidgetId(record.id)) continue;
    if (seen.has(record.id)) continue;
    const size = record.size === "sm" || record.size === "md" || record.size === "lg" || record.size === "xl"
      ? record.size
      : (getWidgetDefinition(record.id)?.defaultSize ?? "md");
    items.push({
      id: record.id,
      size,
      enabled: record.enabled !== false,
    });
    seen.add(record.id);
  }
  for (const fallback of DEFAULT_WIDGET_LAYOUT) {
    if (!seen.has(fallback.id)) {
      items.push({ ...fallback, enabled: false });
      seen.add(fallback.id);
    }
  }
  return items.length ? items : DEFAULT_WIDGET_LAYOUT.map((item) => ({ ...item }));
}

export function enabledWidgetsSorted(layout: WidgetLayoutItem[]): WidgetLayoutItem[] {
  return layout.filter((item) => item.enabled);
}
