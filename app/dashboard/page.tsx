import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { MemberShell } from "../components/MemberShell";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine";
import { createTradingDecision } from "../lib/trading-decision-engine";
import { createStructuredTradePlan } from "../lib/structured-trade-planner";
import {
  formatUkTimestamp,
  isDecisionReadySnapshot,
  formatSnapshotAge,
} from "../lib/market-data";
import { getConfiguredFmpCandlesForInstruments, toCustomerCandleSeries } from "../lib/providers/financial-modeling-prep-candles";
import { getTerminalMarketData } from "../terminal/lib/terminal-market-data-provider";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "../terminal/lib/membership-entitlement";
import { loadPreviewClaims } from "../terminal/lib/preview-access";
import { readSessionClock } from "../terminal/lib/session-clock";
import { currentServerTimestamp, memberDisplayName } from "./lib/daily-dashboard.ts";
import { primaryLevel } from "./lib/command-centre.ts";
import { MarketCommandCentre } from "./components/MarketCommandCentre";
import type { StripQuote } from "./components/MarketIntelligenceStrip";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Market Command Centre | NASH AI Markets",
  description: "Premium Elite dashboard workspace with verified delayed market intelligence.",
  robots: { index: false, follow: false },
};

function parsePercent(change: string): string | null {
  const match = change.match(/(-?\d+(?:\.\d+)?)\s*%/);
  return match ? `${match[1]}%` : null;
}

function buildStripQuotes(
  quotes: Array<{ symbol: string; label: string; value: string; change: string; direction: "up" | "down" | "flat" }>,
  asOfLabel: string,
  sparklines: Record<string, number[]>,
): StripQuote[] {
  const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const cards: Array<{ id: string; name: string; symbols: string[]; note?: string }> = [
    { id: "ES", name: "ES Futures", symbols: ["ES"] },
    { id: "VIX", name: "VIX", symbols: ["VIX"] },
    { id: "DXY", name: "DXY", symbols: ["DXY"] },
    { id: "US10Y", name: "US10Y Treasury", symbols: ["US10Y"] },
    { id: "GOLD", name: "Gold", symbols: ["GOLD", "GLD"], note: "Awaiting verified gold / GLD provider coverage." },
    { id: "NDX", name: "Nasdaq 100", symbols: ["QQQ", "NQ"], note: "Uses verified QQQ / Nasdaq reference when available." },
  ];

  return cards.map((card) => {
    const quote = card.symbols.map((symbol) => bySymbol.get(symbol)).find(Boolean);
    if (!quote) {
      return {
        id: card.id,
        name: card.name,
        value: null,
        change: null,
        percent: null,
        direction: "unknown",
        sparkline: [],
        updatedAt: null,
        coverage: "awaiting",
        note: card.note ?? "Verified provider feed not connected for this instrument.",
      };
    }
    return {
      id: card.id,
      name: card.name,
      value: quote.value,
      change: quote.change,
      percent: parsePercent(quote.change),
      direction: quote.direction,
      sparkline: sparklines[quote.symbol] ?? sparklines[card.id] ?? [],
      updatedAt: asOfLabel,
      coverage: "live",
    };
  });
}

export default async function MemberDashboard() {
  const now = currentServerTimestamp();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: onboarding, error: onboardingError } = await supabase
    .from("member_onboarding")
    .select("completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!onboardingError && !onboarding?.completed_at) redirect("/onboarding");

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end, billing_interval")
    .ilike("email", user.email)
    .in("plan", ["free", "pro", "elite"])
    .maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(membershipError), now);
  if (tier === "temporarily_unavailable") redirect(membershipRedirect(tier));

  const previewState = await loadPreviewClaims(user.id);
  const access = createProgressiveAccess(tier, previewState.claims);
  const paid = access.tier === "pro" || access.tier === "elite";
  const displayName = memberDisplayName(user.email, user.user_metadata as Record<string, unknown> | undefined);
  const session = readSessionClock(new Date(now));

  const [{ snapshot, gatewayStatus }, candleBundle] = await Promise.all([
    getTerminalMarketData(),
    paid ? getConfiguredFmpCandlesForInstruments("5m").catch(() => null) : Promise.resolve(null),
  ]);

  const candleSeries = candleBundle ? toCustomerCandleSeries(candleBundle.ES) : null;
  const sparklines: Record<string, number[]> = {};
  if (candleBundle) {
    for (const [key, series] of Object.entries(candleBundle)) {
      const customer = toCustomerCandleSeries(series);
      sparklines[key] = customer.candles.slice(-24).map((candle) => candle.close);
    }
  }

  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: gatewayStatus.connectionStatus,
    dataAgeMs: gatewayStatus.dataAgeMs,
    fallbackActive: gatewayStatus.fallbackActive,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: snapshot.status,
    providerStatus: gatewayStatus.connectionStatus,
    dataAgeMs: gatewayStatus.dataAgeMs,
    fallbackActive: gatewayStatus.fallbackActive,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });

  const verified = isDecisionReadySnapshot(snapshot) && intelligence.actionable;
  const support = primaryLevel(snapshot, "support");
  const resistance = primaryLevel(snapshot, "resistance");
  const asOfLabel = formatUkTimestamp(snapshot.asOf);
  const dataAgeLabel = formatUkTimestamp(snapshot.asOf) !== "Timestamp unavailable"
    ? formatSnapshotAge(snapshot.asOf, now)
    : gatewayStatus.dataAgeMs != null
      ? `${Math.max(1, Math.round(gatewayStatus.dataAgeMs / 60_000))}m old`
      : "Age unavailable";
  const stripQuotes = buildStripQuotes(snapshot.quotes, asOfLabel, sparklines);

  const pretty = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ");
  const scenarioCopy = (type: "BULLISH" | "BEARISH" | "NEUTRAL") => {
    const scenario = intelligence.scenarios.find((item) => item.type === type);
    if (!scenario) return null;
    const trigger = scenario.trigger.level
      ? `${pretty(scenario.trigger.kind)} near ${scenario.trigger.level}`
      : pretty(scenario.trigger.kind);
    const invalidation = scenario.invalidation.level
      ? `${pretty(scenario.invalidation.kind)} near ${scenario.invalidation.level}`
      : pretty(scenario.invalidation.kind);
    return `${scenario.probability}% weight · Trigger: ${trigger}. Invalidation: ${invalidation}.`;
  };
  const bullishScenario = scenarioCopy("BULLISH");
  const bearishScenario = scenarioCopy("BEARISH");
  const neutralScenario = scenarioCopy("NEUTRAL");
  const rangeHigh = candleSeries?.candles.length
    ? Math.max(...candleSeries.candles.slice(-48).map((candle) => candle.high))
    : null;
  const rangeLow = candleSeries?.candles.length
    ? Math.min(...candleSeries.candles.slice(-48).map((candle) => candle.low))
    : null;
  const expectedMove = verified && rangeHigh != null && rangeLow != null
    ? `${(rangeHigh - rangeLow).toLocaleString("en-GB", { maximumFractionDigits: 2 })} pts (verified 48-bar range)`
    : "Unavailable without verified range inputs";

  const outlook = {
    verified,
    bullish: verified
      ? bullishScenario ?? `Upside path remains conditional on ${pretty(decision.marketBias)} confirmation.`
      : "Bullish scenario withheld until verified decision inputs clear.",
    bearish: verified
      ? bearishScenario ?? `Downside path remains conditional. Risk ${decision.riskRating}.`
      : "Bearish scenario withheld until verified decision inputs clear.",
    neutral: verified
      ? decision.tradePermission === "no-trade"
        ? decision.noTradeReasons[0] ?? neutralScenario ?? "No-trade conditions active — remain sidelined."
        : plan.reasonsToRemainSidelined[0] ?? neutralScenario ?? "Neutral / selective participation only."
      : "Neutral / no-trade stance held while the provider decision window is incomplete.",
    expectedMove,
    keySupport: support?.value ?? "Unavailable",
    keyResistance: resistance?.value ?? "Unavailable",
    riskRating: verified ? decision.riskRating : "Unrated",
    aiConfidence: verified
      ? `${Math.round(decision.confidenceScore || intelligence.scores.bullseyeConfidence || 0)} / 100`
      : "Unavailable",
    disclaimer:
      "Outlook uses deterministic Bullseye engines on delayed verified data. Not personalised advice. Market Data: Delayed (~10 minutes).",
  };

  return (
    <MemberShell active="dashboard">
      <MarketCommandCentre
        memberName={displayName}
        tierLabel={access.tier.toUpperCase()}
        dataStatus={snapshot.status}
        dataAgeLabel={dataAgeLabel}
        asOfLabel={asOfLabel}
        session={session}
        candleSeries={candleSeries}
        stripQuotes={stripQuotes}
        outlook={outlook}
      />
    </MemberShell>
  );
}
