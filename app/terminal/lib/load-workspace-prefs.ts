import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WORKSPACE_PREFS_COOKIE,
  defaultWorkspacePreferences,
  hasCompletedMarketSelection,
  normalizeWorkspacePreferences,
  prefsFromDbRow,
  safeDefaultPrefs,
  layoutForPreset,
  isWorkspacePresetId,
  type WorkspacePreferences,
} from "../../lib/workspace/index.ts";

export type LoadedWorkspacePrefs = {
  preferences: WorkspacePreferences;
  persisted: boolean;
  completedSelection: boolean;
};

function prefsFromCookieValue(raw: string | undefined): WorkspacePreferences | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    const base = normalizeWorkspacePreferences({
      ...parsed,
      widgets: Array.isArray(parsed.widgets)
        ? parsed.widgets
        : typeof parsed.preset === "string" && isWorkspacePresetId(parsed.preset)
          ? layoutForPreset(parsed.preset)
          : undefined,
    });
    return base ?? defaultWorkspacePreferences(parsed as Partial<WorkspacePreferences>);
  } catch {
    return null;
  }
}

/**
 * Load workspace prefs for the authenticated user.
 * Order: DB row → cookie fallback → defaults.
 * Degrades safely when the migration is not applied.
 */
export async function loadMemberWorkspacePrefs(
  supabase: SupabaseClient,
  userId: string,
): Promise<LoadedWorkspacePrefs> {
  const jar = await cookies();
  const cookiePrefs = prefsFromCookieValue(jar.get(WORKSPACE_PREFS_COOKIE)?.value);

  try {
    const { data, error } = await supabase
      .from("member_workspace_prefs")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!error && data) {
      const preferences = prefsFromDbRow(data as Record<string, unknown>);
      if (preferences) {
        return {
          preferences,
          persisted: true,
          completedSelection: hasCompletedMarketSelection(preferences),
        };
      }
    }
  } catch {
    /* table missing or network — fall through */
  }

  if (cookiePrefs) {
    return {
      preferences: cookiePrefs,
      persisted: false,
      completedSelection: hasCompletedMarketSelection(cookiePrefs),
    };
  }

  return {
    preferences: safeDefaultPrefs(),
    persisted: false,
    completedSelection: false,
  };
}
