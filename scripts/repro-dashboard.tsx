/**
 * Diagnostic only — reproduces the /dashboard data-assembly paths outside Next
 * so a render throw can be attributed to a specific input shape.
 *
 * Run: node --import tsx scripts/repro-dashboard.tsx
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MarketCommandCentre, type MarketCommandCentreProps } from "../app/dashboard/components/MarketCommandCentre.tsx";
import { buildDeskGreeting } from "../app/dashboard/lib/market-weather.ts";
import { buildDashboardCommandSummary } from "../app/dashboard/lib/dashboard-command-summary.ts";
import { buildAiMarketInsight } from "../app/lib/ai-market-insight.ts";
import { buildOracleBundle } from "../app/lib/oracle/build-oracle-bundle.ts";
import { sanitizeForClient } from "../app/lib/serialize-for-client.ts";
import { createUnavailableSnapshot } from "../app/lib/market-data.ts";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import { readSessionClock } from "../app/terminal/lib/session-clock.ts";
import { createUnconfiguredMarketGatewayStatus } from "../app/lib/live-market-gateway.ts";

const now = Date.now();

/** Mirrors the `catch` branch of app/dashboard/page.tsx. */
function recoveryCentre(applySanitize: boolean): MarketCommandCentreProps {
  const snapshot = createUnavailableSnapshot();
  const gatewayStatus = createUnconfiguredMarketGatewayStatus("Dashboard recovery");
  const session = readSessionClock(new Date(now));
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: gatewayStatus.connectionStatus,
    dataAgeMs: gatewayStatus.dataAgeMs,
    fallbackActive: true,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: snapshot.status,
    providerStatus: gatewayStatus.connectionStatus,
    dataAgeMs: gatewayStatus.dataAgeMs,
    fallbackActive: true,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const greeting = buildDeskGreeting("Chris", session, new Date(now));
  const summary = buildDashboardCommandSummary({
    snapshot,
    session,
    candleSeries: null,
    decision,
    plan,
    signals: null,
    warnings: ["Verified market data is currently unavailable"],
    now,
  });
  const insight = buildAiMarketInsight({ snapshot, intelligence, decision, plan, verified: false, now });
  const oracle = buildOracleBundle({
    snapshot,
    intelligence,
    decision,
    plan,
    session,
    verified: false,
    freshnessLabel: "Delayed market data · age unavailable",
    candles: null,
    support: null,
    resistance: null,
    now,
  });

  const raw = {
    greeting,
    tierLabel: "Pro",
    summary,
    insight,
    oracle,
    now,
    session,
    quotes: snapshot.quotes,
    plan: null,
  };
  const props = applySanitize ? sanitizeForClient(raw) : raw;

  return {
    greeting: props.greeting,
    tierLabel: props.tierLabel,
    summary: props.summary,
    insight: props.insight,
    oracle: props.oracle,
    candleSeries: null,
    now: props.now,
    session: props.session,
    quotes: props.quotes,
    plan: props.plan,
  } as MarketCommandCentreProps;
}

/** Reports values that JSON round-tripping silently corrupts. */
function findLossyValues(value: unknown, path = "$", out: string[] = []): string[] {
  if (value === null || typeof value !== "object") {
    if (typeof value === "bigint") out.push(`${path}: bigint (JSON.stringify throws)`);
    if (typeof value === "number" && !Number.isFinite(value)) out.push(`${path}: ${String(value)}`);
    return out;
  }
  if (value instanceof Date) out.push(`${path}: Date -> string after sanitize`);
  else if (value instanceof Map) out.push(`${path}: Map -> {} after sanitize`);
  else if (value instanceof Set) out.push(`${path}: Set -> {} after sanitize`);
  else if (Array.isArray(value)) value.forEach((item, i) => findLossyValues(item, `${path}[${i}]`, out));
  else for (const [k, v] of Object.entries(value)) findLossyValues(v, `${path}.${k}`, out);
  return out;
}

function attempt(label: string, build: () => MarketCommandCentreProps) {
  let centre: MarketCommandCentreProps;
  try {
    centre = build();
  } catch (error) {
    console.log(`\n[${label}] DATA ASSEMBLY THREW`);
    console.log(error instanceof Error ? `${error.name}: ${error.message}\n${error.stack}` : String(error));
    return;
  }

  const lossy = findLossyValues(centre);
  if (lossy.length) {
    console.log(`\n[${label}] values at risk from JSON round-trip:`);
    for (const entry of lossy.slice(0, 25)) console.log(`  - ${entry}`);
  }

  try {
    const html = renderToStaticMarkup(createElement(MarketCommandCentre, centre));
    console.log(`\n[${label}] RENDER OK — ${html.length} chars`);
  } catch (error) {
    console.log(`\n[${label}] RENDER THREW`);
    console.log(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    if (error instanceof Error && error.stack) {
      console.log(error.stack.split("\n").slice(0, 12).join("\n"));
    }
  }
}

/** Mirrors the `try` branch: real context loader, degraded provider (preview-like). */
async function liveCentre(): Promise<MarketCommandCentreProps> {
  const { getVerifiedMarketContext } = await import("../app/lib/verified-market-context.ts");
  const { primaryLevel } = await import("../app/dashboard/lib/command-centre.ts");
  const { resolveSessionMarketVideos } = await import("../app/lib/market-video/session-placement.ts");

  const context = await getVerifiedMarketContext({ paid: true, now, route: "/dashboard" });
  console.log(
    `  context.status=${context.status} verified=${context.verified} ` +
      `snapshot=${context.snapshot.status} quotes=${context.snapshot.quotes.length} ` +
      `candles=${context.candles?.candles?.length ?? "null"} missing=[${context.missingInputs.join(", ")}]`,
  );

  const greeting = buildDeskGreeting("Chris", context.session, new Date(now));
  const summary = buildDashboardCommandSummary({
    snapshot: context.snapshot,
    session: context.session,
    candleSeries: context.candles,
    decision: context.decision,
    plan: context.plan,
    signals: null,
    warnings: context.warnings,
    now,
  });
  const sessionVideos = resolveSessionMarketVideos({ phase: context.session.phase, now });
  const insight = buildAiMarketInsight({
    snapshot: context.snapshot,
    intelligence: context.intelligence,
    decision: context.decision,
    plan: context.plan,
    verified: context.verified,
    warnings: context.warnings,
    now,
  });
  const support = primaryLevel(context.snapshot, "support");
  const resistance = primaryLevel(context.snapshot, "resistance");
  const oracle = buildOracleBundle({
    snapshot: context.snapshot,
    intelligence: context.intelligence,
    decision: context.decision,
    plan: context.plan,
    session: context.session,
    verified: context.verified,
    freshnessLabel: summary.hero.delayedAgeLine,
    warnings: context.warnings,
    candles: context.candles?.candles ?? null,
    support: support?.value ?? null,
    resistance: resistance?.value ?? null,
    now,
  });

  const props = sanitizeForClient({
    greeting,
    tierLabel: "Pro",
    summary,
    insight,
    oracle,
    candleSeries: context.candles,
    now,
    marketVideo: sessionVideos.dashboardSelection,
    postMarketPendingNotice: sessionVideos.postMarketPendingNotice,
    archiveAvailable: sessionVideos.archive.length > 0,
    session: context.session,
    quotes: context.snapshot.quotes,
    plan: context.plan,
  });

  return props as unknown as MarketCommandCentreProps;
}

attempt("recovery path, sanitized (what production does)", () => recoveryCentre(true));
attempt("recovery path, unsanitized (control)", () => recoveryCentre(false));

console.log("\n[live path] calling real getVerifiedMarketContext (provider will degrade locally)...");
const live = await liveCentre().catch((error) => {
  console.log("[live path] DATA ASSEMBLY THREW");
  console.log(error instanceof Error ? `${error.name}: ${error.message}\n${error.stack}` : String(error));
  return null;
});
if (live) attempt("live path (partial/degraded provider)", () => live);
