import { NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server.ts";
import {
  WORKSPACE_PREFS_COOKIE,
  normalizeWorkspacePreferences,
  prefsFromDbRow,
  prefsToRpcArgs,
  safeDefaultPrefs,
} from "../../../lib/workspace/index.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function attachPrefsCookie(response: NextResponse, preferences: ReturnType<typeof normalizeWorkspacePreferences>) {
  if (!preferences) return response;
  // Compact cookie payload — full widget layout restored from preset/defaults on load.
  const compact = {
    favourites: preferences.favourites,
    primaryInstrument: preferences.primaryInstrument,
    activeInstrument: preferences.activeInstrument,
    chartTimeframe: preferences.chartTimeframe,
    preset: preferences.preset,
    notes: preferences.notes.slice(0, 500),
    checklist: preferences.checklist.slice(0, 10),
    dismissedOnboarding: true,
    lastWorkspaceAt: preferences.lastWorkspaceAt ?? new Date().toISOString(),
  };
  response.cookies.set({
    name: WORKSPACE_PREFS_COOKIE,
    value: encodeURIComponent(JSON.stringify(compact)),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") && request.headers.get("origin") !== origin) {
    return NextResponse.json({ ok: false, code: "INVALID_ORIGIN" }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from("member_workspace_prefs")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      return NextResponse.json({
        ok: true,
        persisted: false,
        preferences: safeDefaultPrefs(),
        code: "PREFS_FALLBACK",
      });
    }
    const preferences = prefsFromDbRow(data as Record<string, unknown> | null) ?? safeDefaultPrefs();
    return NextResponse.json({
      ok: true,
      persisted: Boolean(data),
      preferences,
    });
  } catch {
    return NextResponse.json({
      ok: true,
      persisted: false,
      preferences: safeDefaultPrefs(),
      code: "PREFS_FALLBACK",
    });
  }
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin) {
    return NextResponse.json({ ok: false, code: "INVALID_ORIGIN" }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  let preferences;
  try {
    preferences = normalizeWorkspacePreferences(await request.json());
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 });
  }
  if (!preferences) {
    return NextResponse.json({ ok: false, code: "INVALID_PREFERENCES" }, { status: 400 });
  }

  const toSave = {
    ...preferences,
    dismissedOnboarding: true,
    lastWorkspaceAt: new Date().toISOString(),
  };

  try {
    const { error } = await supabase.rpc("save_member_workspace_prefs", prefsToRpcArgs(toSave));
    if (error) {
      return attachPrefsCookie(
        NextResponse.json({
          ok: true,
          persisted: false,
          preferences: toSave,
          code: "PREFS_SAVE_FALLBACK",
        }),
        toSave,
      );
    }
    return attachPrefsCookie(
      NextResponse.json({ ok: true, persisted: true, preferences: toSave }),
      toSave,
    );
  } catch {
    return attachPrefsCookie(
      NextResponse.json({
        ok: true,
        persisted: false,
        preferences: toSave,
        code: "PREFS_SAVE_FALLBACK",
      }),
      toSave,
    );
  }
}
