import { NextResponse } from "next/server";
import { createAdminClient } from "../../../utils/supabase/admin.ts";
import { createClient } from "../../../utils/supabase/server.ts";
import { normalizeFoundingOnboarding } from "../../lib/launch-onboarding.ts";
import { resolveMembershipTier } from "../../terminal/lib/membership-entitlement.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const suppliedOrigin = request.headers.get("origin");
  if (suppliedOrigin !== requestOrigin) {
    return NextResponse.json({ ok: false, code: "INVALID_ORIGIN" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end")
    .ilike("email", user.email)
    .in("plan", ["pro", "elite"])
    .maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(membershipError));
  if (tier === "temporarily_unavailable") {
    return NextResponse.json({ ok: false, code: "ACCESS_UNAVAILABLE" }, { status: 503 });
  }
  if (tier !== "pro" && tier !== "elite") {
    return NextResponse.json({ ok: false, code: "PAID_MEMBERSHIP_REQUIRED" }, { status: 403 });
  }

  let submission = null;
  try {
    submission = normalizeFoundingOnboarding(await request.json());
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 });
  }
  if (!submission) return NextResponse.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 });

  try {
    const { error } = await createAdminClient().from("founding_member_onboarding").upsert({
      user_id: user.id,
      email: user.email.toLowerCase(),
      primary_goal: submission.primaryGoal,
      experience_level: submission.experienceLevel,
      preferred_session: submission.preferredSession,
      risk_acknowledged: submission.riskAcknowledged,
      status: "pending",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ ok: false, code: "ONBOARDING_UNAVAILABLE" }, { status: 503 });
  } catch {
    return NextResponse.json({ ok: false, code: "ONBOARDING_UNAVAILABLE" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, status: "pending" });
}
