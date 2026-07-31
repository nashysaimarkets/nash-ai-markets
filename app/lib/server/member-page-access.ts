import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../../../utils/supabase/server.ts";
import { currentServerTimestamp } from "../../dashboard/lib/daily-dashboard.ts";
import {
  createProgressiveAccess,
  membershipRedirect,
  resolveMembershipTier,
  type ProgressiveAccess,
} from "../../terminal/lib/membership-entitlement.ts";
import { loadPreviewClaims } from "../../terminal/lib/preview-access.ts";
import { membershipEmailKey } from "./membership-email.ts";

export async function requireMemberPage(): Promise<{
  user: User;
  email: string;
  access: ProgressiveAccess;
  previewState: Awaited<ReturnType<typeof loadPreviewClaims>>;
  now: number;
  supabase: Awaited<ReturnType<typeof createClient>>;
}> {
  const now = currentServerTimestamp();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end")
    .eq("email", membershipEmailKey(user.email))
    .in("plan", ["free", "pro", "elite"])
    .maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(membershipError), now);
  if (tier === "temporarily_unavailable") redirect(membershipRedirect(tier));

  const previewState = await loadPreviewClaims(user.id);
  const access = createProgressiveAccess(tier, previewState.claims, now);
  return { user, email: user.email, access, previewState, now, supabase };
}
