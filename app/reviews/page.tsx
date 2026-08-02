import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { MemberShell } from "../components/MemberShell";
import { MarketVideoArchive } from "../components/MarketVideoArchive.tsx";
import { loadPublishedMarketVideos } from "../lib/market-video/load-published.ts";
import { listPublishedMarketVideoArchive } from "../lib/market-video/select.ts";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "../terminal/lib/membership-entitlement";
import { loadPreviewClaims } from "../terminal/lib/preview-access";
import { currentServerTimestamp } from "../dashboard/lib/daily-dashboard.ts";
import { membershipEmailKey } from "../lib/server/membership-email.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Previous market reviews | NASH AI Markets",
  description: "Published pre-market and post-market video reviews.",
  robots: { index: false, follow: false },
};

/** Limited archive of published market videos — no drafts or scheduled items. */
export default async function MarketReviewsPage() {
  const now = currentServerTimestamp();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  createProgressiveAccess(tier, previewState.claims);

  const archive = listPublishedMarketVideoArchive(loadPublishedMarketVideos(), 24);

  return (
    <MemberShell active="brief">
      <div className="marketReviewsPage">
        {archive.length ? (
          <MarketVideoArchive videos={archive} />
        ) : (
          <section className="marketVideoArchive is-empty" role="status">
            <h1>Previous market reviews</h1>
            <p>
              No published market videos are listed yet. The verified written Morning Brief remains available.
            </p>
          </section>
        )}
      </div>
    </MemberShell>
  );
}
