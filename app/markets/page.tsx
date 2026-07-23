import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import { MemberShell } from "../components/MemberShell";
import { getTerminalMarketData } from "../terminal/lib/terminal-market-data-provider";
import { getConfiguredFmpCandlesForInstruments, toCustomerCandleSeries } from "../lib/providers/financial-modeling-prep-candles";
import { sparklineFromCandles } from "../components/mini-visuals/mini-visual-data";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "../terminal/lib/membership-entitlement";
import { loadPreviewClaims } from "../terminal/lib/preview-access";
import { loadMemberWorkspacePrefs } from "../terminal/lib/load-workspace-prefs";
import { MarketSelectionGallery } from "./MarketSelectionGallery";
import { buildWorkspaceGreeting } from "../lib/workspace/greeting";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Choose markets | NASH AI Markets",
  description: "Select favourite markets and build your personal trading desk.",
  robots: { index: false, follow: false },
};

export default async function MarketsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/markets");
  if (!user.email) redirect("/?membership=required#membership");

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end")
    .ilike("email", user.email)
    .in("plan", ["free", "pro", "elite"])
    .maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(membershipError));
  if (tier === "temporarily_unavailable") redirect(membershipRedirect(tier));
  const previewState = await loadPreviewClaims(user.id);
  const access = createProgressiveAccess(tier, previewState.claims);
  const paid = access.tier === "pro" || access.tier === "elite";

  const [{ snapshot }, candleBundleRaw, workspace] = await Promise.all([
    getTerminalMarketData(),
    paid ? getConfiguredFmpCandlesForInstruments("5m") : Promise.resolve(null),
    loadMemberWorkspacePrefs(supabase, user.id),
  ]);

  const quotesByBoard: Record<string, (typeof snapshot.quotes)[number] | undefined> = {};
  for (const quote of snapshot.quotes) quotesByBoard[quote.symbol] = quote;

  const sparklinesByBoard: Record<string, number[] | null> = {};
  if (candleBundleRaw) {
    for (const key of ["ES", "VIX", "DXY", "OIL", "QQQ", "NQ"] as const) {
      const series = toCustomerCandleSeries(candleBundleRaw[key]);
      sparklinesByBoard[key] = series.candles.length ? sparklineFromCandles(series.candles) : null;
    }
  }

  const greeting = buildWorkspaceGreeting({
    email: user.email,
    userMetadata: (user.user_metadata ?? null) as Record<string, unknown> | null,
    favourites: workspace.preferences.favourites,
  });

  return (
    <MemberShell active="terminal" className="customerTerminal premiumTerminal personalWorkspacePage">
      <div className="memberDashboardShell pwShell">
        <MarketSelectionGallery
          quotesByBoard={quotesByBoard}
          sparklinesByBoard={sparklinesByBoard}
          initialFavourites={workspace.persisted ? workspace.preferences.favourites : []}
          memberName={greeting.headline.includes(",") ? greeting.headline.split(",")[1]?.replace(".", "").trim() : null}
        />
      </div>
    </MemberShell>
  );
}
