import { NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server.ts";
import { normalizeOnboardingPreferences } from "../../lib/onboarding.ts";
import { rejectCrossOriginCoded } from "../../lib/server/same-origin.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readPreferences(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return request.json();
  const form = await request.formData();
  return {
    experience: form.get("experience"),
    interests: form.getAll("interests"),
    notifications: form.get("notifications"),
    redirectTo: form.get("redirectTo"),
  };
}

function safeRedirectTo(value: unknown) {
  return value === "/profile?preferences=updated" ? value : "/dashboard";
}

export async function POST(request: Request) {
  const blocked = rejectCrossOriginCoded(request);
  if (blocked) return blocked;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });
  let preferences;
  let redirectTo = "/dashboard";
  try {
    const input = await readPreferences(request);
    preferences = normalizeOnboardingPreferences(input);
    redirectTo = safeRedirectTo(input && typeof input === "object" ? (input as Record<string, unknown>).redirectTo : null);
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 });
  }
  if (!preferences) return NextResponse.json({ ok: false, code: "INVALID_PREFERENCES" }, { status: 400 });
  try {
    const { error } = await supabase.rpc("save_member_onboarding", {
      p_experience: preferences.experience,
      p_interests: preferences.interests,
      p_notifications: preferences.notifications,
    });
    if (error) throw error;
    const redirectUrl = request.headers.get("accept")?.includes("application/json")
      ? null
      : new URL(redirectTo, request.url);
    if (redirectUrl) return NextResponse.redirect(redirectUrl, 303);
    return NextResponse.json({ ok: true, redirectTo });
  } catch {
    return NextResponse.json({ ok: false, code: "ONBOARDING_UNAVAILABLE" }, { status: 503 });
  }
}
