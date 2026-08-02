/**
 * Desk Builder widget registry — interchangeable market tools.
 * Widgets render verified data when available; otherwise truthful empty states.
 */

export const DESK_WIDGET_IDS = [
  "primary-chart",
  "quote-overview",
  "structure-map",
  "edge-brief",
  "catalyst-radar",
  "economic-calendar",
  "earnings-calendar",
  "news-intelligence",
  "volatility-context",
  "desk-signals",
  "session-clock",
  "compare-rail",
  "watchlist",
  "preferred-platform",
  "platform-embed",
  "risk-toolkit",
  "journal-lite",
  "freshness-trust",
] as const;

export type DeskWidgetId = (typeof DESK_WIDGET_IDS)[number];

export type DeskWidgetMeta = {
  id: DeskWidgetId;
  label: string;
  description: string;
  /** Stage widgets stay dominant in Focus Mode. */
  stage: boolean;
  /** Local-only tools (no market feed required). */
  localTool?: boolean;
  defaultEnabled: boolean;
};

export const DESK_WIDGET_REGISTRY: Record<DeskWidgetId, DeskWidgetMeta> = {
  "primary-chart": {
    id: "primary-chart",
    label: "Primary chart",
    description: "Verified candlesticks with timeframe controls and freshness labels.",
    stage: true,
    defaultEnabled: true,
  },
  "quote-overview": {
    id: "quote-overview",
    label: "Quote overview",
    description: "Last, change, session context, and data age from the verified snapshot.",
    stage: true,
    defaultEnabled: true,
  },
  "structure-map": {
    id: "structure-map",
    label: "Structure map",
    description: "Educational S/R, range position, and EMA context from verified candles.",
    stage: true,
    defaultEnabled: true,
  },
  "edge-brief": {
    id: "edge-brief",
    label: "Edge brief",
    description: "60-second plain-English briefing from verified quote, candle, and calendar only.",
    stage: true,
    defaultEnabled: true,
  },
  "catalyst-radar": {
    id: "catalyst-radar",
    label: "Catalyst radar",
    description: "Unified timeline of macro events relevant to your favourites.",
    stage: false,
    defaultEnabled: true,
  },
  "economic-calendar": {
    id: "economic-calendar",
    label: "Economic calendar",
    description: "US medium/high-impact releases from the verified FMP calendar path.",
    stage: false,
    defaultEnabled: true,
  },
  "earnings-calendar": {
    id: "earnings-calendar",
    label: "Earnings calendar",
    description: "Earnings coverage when a verified provider path exists.",
    stage: false,
    defaultEnabled: true,
  },
  "news-intelligence": {
    id: "news-intelligence",
    label: "News intelligence",
    description: "Market news filtered by active instrument when a verified feed is wired.",
    stage: false,
    defaultEnabled: true,
  },
  "volatility-context": {
    id: "volatility-context",
    label: "Volatility / VIX",
    description: "Verified VIX quote and optional candle context when available.",
    stage: false,
    defaultEnabled: true,
  },
  "desk-signals": {
    id: "desk-signals",
    label: "Desk signals",
    description: "Educational directional lean derived only from verified desk inputs.",
    stage: false,
    defaultEnabled: true,
  },
  "session-clock": {
    id: "session-clock",
    label: "Session command",
    description: "Open/close countdowns from published US equity session rules.",
    stage: false,
    defaultEnabled: true,
  },
  "compare-rail": {
    id: "compare-rail",
    label: "Compare rail",
    description: "Side-compare favourites that have verified candle coverage.",
    stage: false,
    defaultEnabled: true,
  },
  watchlist: {
    id: "watchlist",
    label: "Watchlist",
    description: "Favourites across interchangeable markets.",
    stage: false,
    defaultEnabled: true,
  },
  "preferred-platform": {
    id: "preferred-platform",
    label: "Preferred platform",
    description: "Launch the active symbol in your preferred trading platform via public deep links.",
    stage: false,
    localTool: true,
    defaultEnabled: true,
  },
  "platform-embed": {
    id: "platform-embed",
    label: "Platform embed",
    description: "Optional sandboxed TradingView chart embed — clearly third-party, no broker login.",
    stage: true,
    localTool: true,
    defaultEnabled: false,
  },
  "risk-toolkit": {
    id: "risk-toolkit",
    label: "Risk toolkit",
    description: "Local position-size and R:R calculators — no fake fills.",
    stage: false,
    localTool: true,
    defaultEnabled: true,
  },
  "journal-lite": {
    id: "journal-lite",
    label: "Journal lite",
    description: "Local notes tied to instrument and day.",
    stage: false,
    localTool: true,
    defaultEnabled: true,
  },
  "freshness-trust": {
    id: "freshness-trust",
    label: "Freshness trust",
    description: "Always-visible LIVE / DELAYED / STALE / UNAVAILABLE feed ages.",
    stage: false,
    defaultEnabled: true,
  },
};

export const DEFAULT_WIDGET_ORDER: DeskWidgetId[] = [
  "freshness-trust",
  "session-clock",
  "quote-overview",
  "preferred-platform",
  "primary-chart",
  "platform-embed",
  "edge-brief",
  "structure-map",
  "watchlist",
  "compare-rail",
  "catalyst-radar",
  "economic-calendar",
  "volatility-context",
  "desk-signals",
  "earnings-calendar",
  "news-intelligence",
  "risk-toolkit",
  "journal-lite",
];

export function isDeskWidgetId(value: string): value is DeskWidgetId {
  return (DESK_WIDGET_IDS as readonly string[]).includes(value);
}
