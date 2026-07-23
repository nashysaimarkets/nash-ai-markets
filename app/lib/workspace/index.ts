import {
  defaultWorkspacePreferences,
  normalizeWorkspacePreferences,
  type WorkspacePreferences,
} from "./prefs.ts";

export type { WorkspacePreferences } from "./prefs.ts";
export {
  defaultWorkspacePreferences,
  normalizeWorkspacePreferences,
  hasCompletedMarketSelection,
  WORKSPACE_PREFS_COOKIE,
} from "./prefs.ts";
export {
  WORKSPACE_INSTRUMENTS,
  GALLERY_INSTRUMENT_IDS,
  galleryInstruments,
  getWorkspaceInstrument,
  isWorkspaceInstrumentId,
  coverageLabel,
  resolveCandleForWorkspace,
  resolveBoardForWorkspace,
  type WorkspaceInstrument,
  type WorkspaceInstrumentId,
} from "./instruments.ts";
export {
  WORKSPACE_WIDGETS,
  DEFAULT_WIDGET_LAYOUT,
  normalizeWidgetLayout,
  enabledWidgetsSorted,
  getWidgetDefinition,
  isWorkspaceWidgetId,
  type WidgetLayoutItem,
  type WorkspaceWidgetId,
} from "./widgets.ts";
export {
  WORKSPACE_PRESETS,
  layoutForPreset,
  getWorkspacePreset,
  isWorkspacePresetId,
  type WorkspacePresetId,
} from "./presets.ts";
export { buildWorkspaceGreeting } from "./greeting.ts";
export { buildMarketReview, type MarketReviewResult } from "./market-review.ts";
export { buildHistoricalContext, type HistoricalContextResult } from "./historical-context.ts";

/** Map a DB row into normalized preferences; null if unusable. */
export function prefsFromDbRow(row: Record<string, unknown> | null | undefined): WorkspacePreferences | null {
  if (!row) return null;
  return normalizeWorkspacePreferences({
    favourites: row.favourites,
    primaryInstrument: row.primary_instrument,
    activeInstrument: row.active_instrument,
    chartTimeframe: row.chart_timeframe,
    widgets: row.widgets,
    preset: row.preset,
    notes: row.notes,
    checklist: row.checklist,
    dismissedOnboarding: row.dismissed_onboarding,
    lastWorkspaceAt: row.last_workspace_at,
  });
}

export function prefsToRpcArgs(prefs: WorkspacePreferences) {
  return {
    p_favourites: prefs.favourites,
    p_primary_instrument: prefs.primaryInstrument,
    p_active_instrument: prefs.activeInstrument,
    p_chart_timeframe: prefs.chartTimeframe,
    p_widgets: prefs.widgets,
    p_preset: prefs.preset,
    p_notes: prefs.notes,
    p_checklist: prefs.checklist,
    p_dismissed_onboarding: prefs.dismissedOnboarding,
  };
}

export function safeDefaultPrefs(): WorkspacePreferences {
  return defaultWorkspacePreferences();
}
