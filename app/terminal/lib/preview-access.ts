import { createAdminClient } from "../../../utils/supabase/admin.ts";
import type { PreviewClaim } from "./membership-entitlement.ts";

export async function loadPreviewClaims(userId: string): Promise<{ claims: PreviewClaim[]; available: boolean }> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("membership_previews")
      .select("target_tier, period_start, claimed_at")
      .eq("user_id", userId)
      .order("claimed_at", { ascending: false })
      .limit(4);
    if (error) return { claims: [], available: false };
    const claims = (data ?? []).filter((claim): claim is PreviewClaim =>
      (claim.target_tier === "pro" || claim.target_tier === "elite") &&
      typeof claim.period_start === "string" &&
      typeof claim.claimed_at === "string",
    );
    return { claims, available: true };
  } catch {
    return { claims: [], available: false };
  }
}
