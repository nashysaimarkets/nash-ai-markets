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
import { LearningWorkflowRail } from "../components/LearningWorkflowRail.tsx";
import Link from "next/link";

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
    <MemberShell active="review" className="reviewsPage">
      <div className="memberDashboardShell marketReviewsPage">
        <LearningWorkflowRail active="reviews" />
        <section className="reviewsHero">
          <div>
            <span>SESSION INTELLIGENCE LIBRARY</span>
            <h1>Review the tape.<br /><em>Refine the process.</em></h1>
            <p>Published pre-market context and post-market learning, organised as a disciplined review loop—not an entertainment feed.</p>
          </div>
          <div className="reviewsOrbit" aria-hidden="true"><i /><i /><i /><span /></div>
          <aside>
            <span>PUBLISHED</span>
            <strong>{archive.length}</strong>
            <small>verified review{archive.length === 1 ? "" : "s"}</small>
            <Link href="/journal">Open private journal ↗</Link>
          </aside>
        </section>
        {archive.length ? (
          <MarketVideoArchive videos={archive} />
        ) : (
          <section className="marketVideoArchive is-empty" role="status">
            <h1>Previous market reviews</h1>
            <p>
              No published market videos are listed yet. The verified written Morning Brief remains available.
            </p>
            <div className="reviewsEmptyActions">
              <Link href="/brief">Open Morning Brief</Link>
              <Link href="/journal">Open private journal</Link>
            </div>
          </section>
        )}
      </div>
    </MemberShell>
  );
}
