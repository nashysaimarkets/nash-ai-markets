import { NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server.ts";
import { normalizeOnboardingPreferences } from "../../lib/onboarding.ts";
import { rejectCrossOriginCoded } from "../../lib/server/same-origin.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = rejectCrossOriginCoded(request);
  if (blocked) return blocked;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });
  let preferences;
  try {
    preferences = normalizeOnboardingPreferences(await request.json());
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
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, code: "ONBOARDING_UNAVAILABLE" }, { status: 503 });
  }
}
