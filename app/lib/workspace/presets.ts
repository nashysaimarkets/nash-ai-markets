/**
 * Workspace layout presets — widget selection/placement only.
 * No unsupported data claims or guaranteed-success language.
 */

import {
  DEFAULT_WIDGET_LAYOUT,
  type WidgetLayoutItem,
  type WorkspaceWidgetId,
} from "./widgets.ts";

export type WorkspacePresetId =
  | "index_day_trader"
  | "futures_scalper"
  | "options_trader"
  | "macro_trader"
  | "earnings_trader"
  | "crypto_desk";

export type WorkspacePreset = {
  id: WorkspacePresetId;
  name: string;
  description: string;
  enabledWidgets: WorkspaceWidgetId[];
};

export const WORKSPACE_PRESETS: readonly WorkspacePreset[] = [
  {
    id: "index_day_trader",
    name: "Index Day Trader",
    description: "Index chart, watchlist, structure, session clock and volatility.",
    enabledWidgets: [
      "primary_chart",
      "market_review",
      "watchlist",
      "instrument_cards",
      "support_resistance",
      "volatility_monitor",
      "vix_gauge",
      "session_clock",
      "opening_range",
      "economic_calendar",
      "ai_assistant",
    ],
  },
  {
    id: "futures_scalper",
    name: "Futures Scalper",
    description: "Fast chart focus with opening range, R:R and checklist.",
    enabledWidgets: [
      "primary_chart",
      "watchlist",
      "opening_range",
      "support_resistance",
      "session_clock",
      "risk_reward",
      "position_size",
      "checklist",
      "volatility_monitor",
    ],
  },
  {
    id: "options_trader",
    name: "Options Trader",
    description: "Volatility, expected-move placeholder, and structure context.",
    enabledWidgets: [
      "primary_chart",
      "market_review",
      "volatility_monitor",
      "vix_gauge",
      "expected_move",
      "support_resistance",
      "economic_calendar",
      "watchlist",
    ],
  },
  {
    id: "macro_trader",
    name: "Macro Trader",
    description: "Treasuries, dollar, calendar and cross-asset monitors.",
    enabledWidgets: [
      "primary_chart",
      "market_review",
      "treasury_monitor",
      "usd_monitor",
      "economic_calendar",
      "news",
      "heatmap",
      "historical_context",
      "watchlist",
    ],
  },
  {
    id: "earnings_trader",
    name: "Earnings Trader",
    description: "Earnings calendar placeholder with news and journal.",
    enabledWidgets: [
      "primary_chart",
      "earnings_calendar",
      "news",
      "watchlist",
      "instrument_cards",
      "journal",
      "notes",
      "ai_assistant",
    ],
  },
  {
    id: "crypto_desk",
    name: "Crypto Desk",
    description: "Desk layout for crypto favourites when coverage arrives.",
    enabledWidgets: [
      "primary_chart",
      "watchlist",
      "instrument_cards",
      "news",
      "volatility_monitor",
      "session_clock",
      "notes",
      "alerts",
    ],
  },
] as const;

const PRESET_BY_ID = new Map(WORKSPACE_PRESETS.map((preset) => [preset.id, preset]));

export function isWorkspacePresetId(value: string): value is WorkspacePresetId {
  return PRESET_BY_ID.has(value as WorkspacePresetId);
}

export function getWorkspacePreset(id: string): WorkspacePreset | null {
  return PRESET_BY_ID.get(id as WorkspacePresetId) ?? null;
}

export function layoutForPreset(presetId: WorkspacePresetId): WidgetLayoutItem[] {
  const preset = PRESET_BY_ID.get(presetId);
  if (!preset) return DEFAULT_WIDGET_LAYOUT.map((item) => ({ ...item }));
  const enabled = new Set(preset.enabledWidgets);
  return DEFAULT_WIDGET_LAYOUT.map((item) => ({
    ...item,
    enabled: enabled.has(item.id),
  }));
}
