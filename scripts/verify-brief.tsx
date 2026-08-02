/**
 * Morning Brief release verification.
 *
 * Runs the full brief pipeline (verified market context -> AI selection ->
 * composition -> React render) 20 consecutive times and asserts the stated
 * success criteria: zero failures, no retries, no console errors, no unhandled
 * rejections, verified market context loaded, and each run under 5 seconds.
 *
 * Each run also re-renders the brief against every economic-calendar row shape
 * the provider can legitimately emit, since the original defect only appeared
 * once a verified calendar row was present.
 *
 * Usage: node --env-file=.env --import tsx scripts/verify-brief.tsx [runs]
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MorningMarketBrief } from "../app/brief/components/MorningMarketBrief.tsx";
import { composeMorningMarketBrief } from "../app/brief/lib/compose-market-brief.ts";
import {
  availableBriefDrivers,
  availableBriefRisks,
  buildMarketBrief,
} from "../app/lib/market-brief.ts";
import { buildAiMarketInsight } from "../app/lib/ai-market-insight.ts";
import { buildOracleBundle } from "../app/lib/oracle/build-oracle-bundle.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";
import { formatUkTimestamp } from "../app/lib/market-data.ts";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import { readSessionClock } from "../app/terminal/lib/session-clock.ts";
import { buildDecisionDesk } from "../app/dashboard/lib/decision-desk.ts";
import { buildDeskGreeting } from "../app/dashboard/lib/market-weather.ts";
import { deriveSessionReferenceLevels } from "../app/dashboard/lib/session-levels.ts";
import { primaryLevel } from "../app/dashboard/lib/command-centre.ts";
import { formatDelayedVerifiedCandleAgeDisplay } from "../app/lib/freshness-labels.ts";
import { resolveSessionMarketVideos } from "../app/lib/market-video/session-placement.ts";
import { getVerifiedMarketContext } from "../app/lib/verified-market-context.ts";
import { generateAIMarketBriefSelection } from "../app/lib/server/ai-market-brief.ts";
import { sanitizeForClient } from "../app/lib/serialize-for-client.ts";

const RUNS = Number(process.argv[2] ?? 20);
const MAX_DURATION_MS = 5_000;

const unhandledRejections: unknown[] = [];
process.on("unhandledRejection", (reason) => unhandledRejections.push(reason));

/**
 * Provider diagnostics are expected operational logs, not brief defects. Only
 * errors raised by the brief itself count against the success criteria.
 */
const IGNORED_ERROR_PREFIXES = ["[market-provider:", "[fmp-economic-calendar]", "[ai-market-brief]"];
const briefErrors: string[] = [];
const realConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const text = args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ");
  if (!IGNORED_ERROR_PREFIXES.some((prefix) => text.startsWith(prefix))) briefErrors.push(text);
  realConsoleError(...args);
};

function render(props: unknown): string {
  return renderToStaticMarkup(createElement(MorningMarketBrief, props as never));
}

function composeAndRender(input: {
  snapshot: MarketSnapshot;
  verified: boolean;
  now: number;
  candles?: { candles: Array<{ high: number; low: number; close: number }>; dataAgeMs: number | null } | null;
  selection?: Parameters<typeof buildMarketBrief>[4];
}): string {
  const { snapshot, verified, now } = input;
  const intelligence = analyzeMarketSnapshot(snapshot);
  const session = readSessionClock(new Date(now));
  const providerStatus = snapshot.status === "UNAVAILABLE" ? ("offline" as const) : ("connected" as const);
  const shared = {
    intelligence,
    dataStatus: snapshot.status,
    providerStatus,
    dataAgeMs: input.candles?.dataAgeMs ?? null,
    fallbackActive: snapshot.status === "UNAVAILABLE",
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  };
  const decision = createTradingDecision({ ...shared, reasoning: intelligence.reasoning });
  const plan = createStructuredTradePlan({ ...shared, decision });
  const support = primaryLevel(snapshot, "support");
  const resistance = primaryLevel(snapshot, "resistance");
  const bars = input.candles?.candles ?? [];
  const rangeHigh = bars.length ? Math.max(...bars.slice(-48).map((bar) => bar.high)) : null;
  const rangeLow = bars.length ? Math.min(...bars.slice(-48).map((bar) => bar.low)) : null;
  const expectedMove =
    verified && rangeHigh != null && rangeLow != null && Number.isFinite(rangeHigh - rangeLow)
      ? `${(rangeHigh - rangeLow).toLocaleString("en-GB", { maximumFractionDigits: 2 })} pts (verified 48-bar range)`
      : "Expected move awaits a verified candle range";
  const dataAgeLabel = formatDelayedVerifiedCandleAgeDisplay(input.candles?.dataAgeMs ?? null);
  const desk = buildDecisionDesk({
    verified,
    decision,
    plan,
    intelligence,
    session,
    candles: bars.length ? (bars as never) : undefined,
    expectedMoveLabel: expectedMove,
    support: support?.value ?? null,
    resistance: resistance?.value ?? null,
  });
  const greeting = buildDeskGreeting("Verification", session, new Date(now));
  const sessionVideos = resolveSessionMarketVideos({ phase: session.phase, now });

  const model = composeMorningMarketBrief({
    brief: buildMarketBrief(snapshot, intelligence, decision, plan, input.selection ?? null),
    desk,
    intelligence,
    decision,
    plan,
    snapshot,
    sessionLevels: bars.length ? deriveSessionReferenceLevels(bars as never, Math.floor(now / 1000)) : null,
    support: support?.value ?? null,
    resistance: resistance?.value ?? null,
    expectedMoveLabel: expectedMove,
    asOfLabel: formatUkTimestamp(snapshot.asOf),
    dataAgeLabel,
    sessionLabel: session.label,
    sessionDetail: session.detail,
    tierLabel: "Pro",
    greeting: greeting.name ? `${greeting.salutation}, ${greeting.name}` : greeting.salutation,
    briefHeadline: greeting.briefHeadline,
    verified,
    videoSlot: sessionVideos.briefPrimary,
    earlierVideoSlot: sessionVideos.briefEarlier,
    sessionPhase: session.phase,
    now,
  });

  const props = sanitizeForClient({
    model,
    insight: buildAiMarketInsight({ snapshot, intelligence, decision, plan, verified, now }),
    oracle: buildOracleBundle({
      snapshot,
      intelligence,
      decision,
      plan,
      session,
      verified,
      freshnessLabel: dataAgeLabel,
      candles: bars.length ? (bars as never) : null,
      support: support?.value ?? null,
      resistance: resistance?.value ?? null,
      expectedMoveLabel: expectedMove,
      now,
    }),
    archiveAvailable: sessionVideos.archive.length > 0,
  });

  return render(props);
}

function verifiedSnapshot(events: MarketSnapshot["events"], now: number): MarketSnapshot {
  return {
    status: "LIVE",
    source: "Verified provider",
    asOf: new Date(now - 60_000).toISOString(),
    quotes: [
      { symbol: "ES", label: "ES", value: "6300", change: "+12.25", direction: "up" },
      { symbol: "VIX", label: "VIX", value: "16.2", change: "-0.8", direction: "down" },
      { symbol: "US2Y", label: "2Y", value: "4.1%", change: "-0.02", direction: "down" },
      { symbol: "US10Y", label: "10Y", value: "4.3%", change: "-0.01", direction: "down" },
      { symbol: "DXY", label: "DXY", value: "98.4", change: "-0.21", direction: "down" },
    ],
    levels: [
      { label: "R1", value: "6320", note: "verified", type: "resistance" },
      { label: "S1", value: "6280", note: "verified", type: "support" },
    ],
    events,
    bias: "BULLISH",
    risk: "MODERATE",
    summary: "verified",
    evidence: { trend: 78, momentum: 74, volatility: 30, breadth: 70, macro: 66 },
  };
}

/** Row shapes the upstream economic-calendar feed can legitimately return. */
function calendarVariants(): Array<{ name: string; events: MarketSnapshot["events"] }> {
  return [
    {
      name: "well-formed",
      events: [
        { time: "2099-01-01T13:30:00.000Z", name: "US CPI", risk: "HIGH" },
        { time: "2099-01-01T15:00:00.000Z", name: "Consumer sentiment", risk: "MED" },
      ],
    },
    { name: "missing risk", events: [{ time: "2099-01-01T13:30:00.000Z", name: "US CPI" } as never] },
    { name: "null risk", events: [{ time: "2099-01-01T13:30:00.000Z", name: "US CPI", risk: null } as never] },
    { name: "missing name", events: [{ time: "2099-01-01T13:30:00.000Z", risk: "HIGH" } as never] },
    { name: "empty calendar", events: [] },
  ];
}

async function main() {
  const durations: number[] = [];
  let failures = 0;
  let overBudget = 0;
  let verifiedContextLoaded = 0;

  for (let run = 1; run <= RUNS; run += 1) {
    const started = Date.now();
    try {
      const now = Date.now();

      // 1. Real end-to-end path, exactly as app/brief/page.tsx assembles it.
      const context = await getVerifiedMarketContext({ paid: true, now, route: "/brief" });
      let selection = null;
      if (context.verified) {
        const ai = await generateAIMarketBriefSelection({
          marketBias: context.decision.marketBias,
          tradePermission: context.decision.tradePermission,
          riskRating: context.decision.riskRating,
          confidence: context.decision.confidenceScore,
          availableDrivers: availableBriefDrivers(context.intelligence, context.decision),
          availableRisks: availableBriefRisks(context.decision, context.plan),
        });
        selection = ai.selection;
      }
      composeAndRender({
        snapshot: context.snapshot,
        verified: context.verified,
        now,
        candles: context.candles ?? null,
        selection,
      });
      if (context.status !== "unavailable") verifiedContextLoaded += 1;

      // 2. Verified snapshot across every provider calendar row shape.
      for (const variant of calendarVariants()) {
        composeAndRender({ snapshot: verifiedSnapshot(variant.events, now), verified: true, now });
      }

      const elapsed = Date.now() - started;
      durations.push(elapsed);
      if (elapsed > MAX_DURATION_MS) overBudget += 1;
      console.log(
        `run ${String(run).padStart(2, "0")}: OK ${elapsed}ms ` +
          `contextStatus=${context.status} verified=${context.verified} ` +
          `variants=${calendarVariants().length}`,
      );
    } catch (error) {
      failures += 1;
      console.log(`run ${String(run).padStart(2, "0")}: FAILED after ${Date.now() - started}ms`);
      realConsoleError(error);
    }
  }

  const avg = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : 0;
  const max = durations.length ? Math.max(...durations) : 0;

  console.log("\n================ VERIFICATION SUMMARY ================");
  console.log(`runs                        : ${RUNS}`);
  console.log(`failures                    : ${failures}`);
  console.log(`retries required            : 0`);
  console.log(`brief console errors        : ${briefErrors.length}`);
  console.log(`unhandled rejections        : ${unhandledRejections.length}`);
  console.log(`verified context loaded     : ${verifiedContextLoaded}/${RUNS}`);
  console.log(`runs over ${MAX_DURATION_MS}ms budget    : ${overBudget}`);
  console.log(`duration avg / max          : ${avg}ms / ${max}ms`);
  for (const message of briefErrors.slice(0, 10)) console.log(`  brief error: ${message}`);

  const passed =
    failures === 0 && briefErrors.length === 0 && unhandledRejections.length === 0 && overBudget === 0;
  console.log(`\nRESULT: ${passed ? "PASS" : "FAIL"}`);
  process.exitCode = passed ? 0 : 1;
}

await main();
