/**
 * Personal trading workspace preferences — normalize + defaults.
 * Persisted via member_workspace_prefs (additive migration; degrade safely if unavailable).
 */

import {
  defaultFavouriteIds,
  isWorkspaceInstrumentId,
  type WorkspaceInstrumentId,
} from "./instruments.ts";
import {
  DEFAULT_WIDGET_LAYOUT,
  normalizeWidgetLayout,
  type WidgetLayoutItem,
} from "./widgets.ts";
import { isWorkspacePresetId, type WorkspacePresetId } from "./presets.ts";
import type { CandleTimeframe } from "../providers/financial-modeling-prep-candles.ts";

const TIMEFRAMES = new Set<CandleTimeframe>(["1m", "5m", "15m", "1h", "4h", "1d"]);

export type WorkspacePreferences = {
  favourites: WorkspaceInstrumentId[];
  primaryInstrument: WorkspaceInstrumentId;
  activeInstrument: WorkspaceInstrumentId;
  chartTimeframe: CandleTimeframe;
  widgets: WidgetLayoutItem[];
  preset: WorkspacePresetId | "custom";
  notes: string;
  checklist: string[];
  dismissedOnboarding: boolean;
  lastWorkspaceAt: string | null;
};

/** Cookie fallback when member_workspace_prefs migration is not applied. */
export const WORKSPACE_PREFS_COOKIE = "nam_workspace_prefs_v1";

export function defaultWorkspacePreferences(
  partial?: Partial<WorkspacePreferences>,
): WorkspacePreferences {
  const favourites = partial?.favourites?.length
    ? partial.favourites
    : defaultFavouriteIds();
  const primary = partial?.primaryInstrument && favourites.includes(partial.primaryInstrument)
    ? partial.primaryInstrument
    : favourites[0]!;
  const active = partial?.activeInstrument && favourites.includes(partial.activeInstrument)
    ? partial.activeInstrument
    : primary;
  return {
    favourites,
    primaryInstrument: primary,
    activeInstrument: active,
    chartTimeframe: partial?.chartTimeframe && TIMEFRAMES.has(partial.chartTimeframe)
      ? partial.chartTimeframe
      : "5m",
    widgets: partial?.widgets ? normalizeWidgetLayout(partial.widgets) : DEFAULT_WIDGET_LAYOUT.map((item) => ({ ...item })),
    preset: partial?.preset && (partial.preset === "custom" || isWorkspacePresetId(partial.preset))
      ? partial.preset
      : "custom",
    notes: typeof partial?.notes === "string" ? partial.notes.slice(0, 4000) : "",
    checklist: Array.isArray(partial?.checklist)
      ? partial.checklist.filter((item): item is string => typeof item === "string").slice(0, 20)
      : [],
    dismissedOnboarding: Boolean(partial?.dismissedOnboarding),
    lastWorkspaceAt: typeof partial?.lastWorkspaceAt === "string" ? partial.lastWorkspaceAt : null,
  };
}

export function normalizeWorkspacePreferences(value: unknown): WorkspacePreferences | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.favourites) || input.favourites.length < 1 || input.favourites.length > 12) {
    return null;
  }
  const favourites = [...new Set(
    input.favourites.filter((item): item is string => typeof item === "string"),
  )].filter(isWorkspaceInstrumentId);
  if (favourites.length < 1) return null;

  const primaryRaw = typeof input.primaryInstrument === "string" ? input.primaryInstrument : favourites[0];
  const activeRaw = typeof input.activeInstrument === "string" ? input.activeInstrument : primaryRaw;
  const primaryInstrument = isWorkspaceInstrumentId(primaryRaw) && favourites.includes(primaryRaw)
    ? primaryRaw
    : favourites[0]!;
  const activeInstrument = isWorkspaceInstrumentId(activeRaw) && favourites.includes(activeRaw)
    ? activeRaw
    : primaryInstrument;

  const chartTimeframe = typeof input.chartTimeframe === "string" && TIMEFRAMES.has(input.chartTimeframe as CandleTimeframe)
    ? input.chartTimeframe as CandleTimeframe
    : "5m";

  const preset = input.preset === "custom" || (typeof input.preset === "string" && isWorkspacePresetId(input.preset))
    ? input.preset as WorkspacePreferences["preset"]
    : "custom";

  return defaultWorkspacePreferences({
    favourites,
    primaryInstrument,
    activeInstrument,
    chartTimeframe,
    widgets: normalizeWidgetLayout(input.widgets),
    preset,
    notes: typeof input.notes === "string" ? input.notes : "",
    checklist: Array.isArray(input.checklist) ? input.checklist as string[] : [],
    dismissedOnboarding: Boolean(input.dismissedOnboarding),
    lastWorkspaceAt: typeof input.lastWorkspaceAt === "string" ? input.lastWorkspaceAt : null,
  });
}

export function hasCompletedMarketSelection(prefs: WorkspacePreferences | null): boolean {
  return Boolean(prefs?.favourites.length && (prefs.dismissedOnboarding || prefs.lastWorkspaceAt));
}
