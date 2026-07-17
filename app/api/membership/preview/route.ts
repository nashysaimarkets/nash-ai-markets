import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../utils/supabase/admin.ts";
import { createClient } from "../../../../utils/supabase/server.ts";
import {
  canClaimPreview,
  createProgressiveAccess,
  resolveMembershipTier,
  type PremiumTier,
} from "../../../terminal/lib/membership-entitlement.ts";
import { loadPreviewClaims } from "../../../terminal/lib/preview-access.ts";

export async function POST(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const suppliedOrigin = request.headers.get("origin");
  if (suppliedOrigin && suppliedOrigin !== requestOrigin) {
    return NextResponse.json({ ok: false, code: "INVALID_ORIGIN" }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  let targetTier: PremiumTier | null = null;
  try {
    const body = await request.json() as { targetTier?: unknown };
    targetTier = body.targetTier === "pro" || body.targetTier === "elite" ? body.targetTier : null;
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 });
  }
  if (!targetTier) return NextResponse.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 });

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end")
    .ilike("email", user.email)
    .in("plan", ["free", "pro", "elite"])
    .maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(membershipError));
  if (tier === "temporarily_unavailable") return NextResponse.json({ ok: false, code: "ACCESS_UNAVAILABLE" }, { status: 503 });

  const previewState = await loadPreviewClaims(user.id);
  if (!previewState.available) return NextResponse.json({ ok: false, code: "PREVIEW_UNAVAILABLE" }, { status: 503 });
  if (!canClaimPreview(tier, targetTier, previewState.claims)) {
    return NextResponse.json({ ok: false, code: "PREVIEW_NOT_ELIGIBLE" }, { status: 409 });
  }

  const offer = createProgressiveAccess(tier, previewState.claims).previewOffer;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("membership_previews").insert({
      user_id: user.id,
      target_tier: targetTier,
      period_start: offer!.periodStart,
      claimed_at: new Date().toISOString(),
    });
    if (error) {
      const duplicate = error.code === "23505";
      return NextResponse.json({ ok: false, code: duplicate ? "PREVIEW_ALREADY_USED" : "PREVIEW_UNAVAILABLE" }, { status: duplicate ? 409 : 503 });
    }
  } catch {
    return NextResponse.json({ ok: false, code: "PREVIEW_UNAVAILABLE" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, targetTier });
}
