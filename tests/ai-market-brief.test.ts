import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import {
  availableBriefDrivers,
  availableBriefRisks,
  buildMarketBrief,
} from "../app/lib/market-brief.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";
import { generateAIMarketBriefSelection } from "../app/lib/server/ai-market-brief.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";

const snapshot: MarketSnapshot = {
  status: "LIVE",
  source: "Verified provider",
  asOf: "2026-07-17T11:59:00.000Z",
  quotes: [
    { symbol: "ES", label: "ES", value: "6300", change: "+1", direction: "up" },
    { symbol: "VIX", label: "VIX", value: "16", change: "-1", direction: "down" },
    { symbol: "US2Y", label: "2Y", value: "4.1%", change: "-1", direction: "down" },
    { symbol: "US10Y", label: "10Y", value: "4.3%", change: "-1", direction: "down" },
    { symbol: "DXY", label: "DXY", value: "98", change: "-1", direction: "down" },
  ],
  levels: [
    { label: "R1", value: "6320", note: "verified", type: "resistance" },
    { label: "S1", value: "6280", note: "verified", type: "support" },
  ],
  events: [],
  bias: "BULLISH",
  risk: "MODERATE",
  summary: "verified",
  evidence: { trend: 78, momentum: 74, volatility: 30, breadth: 70, macro: 66 },
};

function engines(current: MarketSnapshot = snapshot) {
  const intelligence = analyzeMarketSnapshot(current);
  const providerStatus = current.status === "UNAVAILABLE" ? "offline" : "connected";
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: current.status,
    providerStatus,
    dataAgeMs: current.status === "UNAVAILABLE" ? null : 60_000,
    fallbackActive: current.status === "UNAVAILABLE",
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: current.status,
    providerStatus,
    dataAgeMs: current.status === "UNAVAILABLE" ? null : 60_000,
    fallbackActive: current.status === "UNAVAILABLE",
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  return { intelligence, decision, plan };
}

test("market brief builds a deterministic grounded baseline", () => {
  const { intelligence, decision, plan } = engines();
  const brief = buildMarketBrief(snapshot, intelligence, decision, plan);
  assert.equal(brief.mode, "deterministic");
  assert.equal(brief.asOf, snapshot.asOf);
  assert.ok(brief.focusDrivers.length > 0);
  assert.ok(brief.confidence !== null && brief.confidence <= decision.confidenceScore);
  assert.doesNotMatch(JSON.stringify(brief), /entry price|stop price|target price/i);
});

test("market brief fails closed without verified current data", () => {
  const unavailable: MarketSnapshot = {
    ...snapshot,
    status: "UNAVAILABLE",
    asOf: "1970-01-01T00:00:00.000Z",
    quotes: [],
    levels: [],
    evidence: {},
  };
  const { intelligence, decision, plan } = engines(unavailable);
  const brief = buildMarketBrief(unavailable, intelligence, decision, plan);
  assert.equal(brief.mode, "unavailable");
  assert.equal(brief.confidence, null);
  assert.equal(brief.marketBias, "neutral");
  assert.equal(brief.tradePermission, "no-trade");
  assert.deepEqual(brief.focusDrivers, []);
});

test("AI selection can only prioritize supplied deterministic evidence", async () => {
  const { intelligence, decision, plan } = engines();
  const availableDrivers = availableBriefDrivers(intelligence, decision);
  const availableRisks = availableBriefRisks(decision, plan);
  let request: Record<string, unknown> | null = null;
  const result = await generateAIMarketBriefSelection({
    marketBias: decision.marketBias,
    tradePermission: decision.tradePermission,
    riskRating: decision.riskRating,
    confidence: decision.confidenceScore,
    availableDrivers,
    availableRisks,
  }, {
    responses: {
      async create(body) {
        request = body;
        return {
          output_text: JSON.stringify({
            emphasis: "aligned",
            focusDrivers: availableDrivers.slice(0, 2),
            primaryRisk: availableRisks[0] ?? "NONE",
          }),
        };
      },
    },
  }, "test-model");
  assert.equal(result.status, "generated");
  assert.match(JSON.stringify(request), /json_schema/);
  assert.doesNotMatch(JSON.stringify(request), /OPENAI_API_KEY|apikey/i);
});

test("AI brief falls back for missing configuration, provider errors, and invalid selections", async () => {
  const input = {
    marketBias: "neutral" as const,
    tradePermission: "caution" as const,
    riskRating: "high" as const,
    confidence: 42,
    availableDrivers: ["TREND"],
    availableRisks: ["CONFLICT"],
  };
  assert.deepEqual(await generateAIMarketBriefSelection(input, null, ""), {
    status: "not_configured",
    selection: null,
  });
  assert.deepEqual(await generateAIMarketBriefSelection(input, {
    responses: { async create() { throw new Error("secret provider detail"); } },
  }, "test-model"), { status: "unavailable", selection: null });
  assert.deepEqual(await generateAIMarketBriefSelection(input, {
    responses: { async create() { return { output_text: JSON.stringify({ emphasis: "aligned", focusDrivers: ["INVENTED"], primaryRisk: "NONE" }) }; } },
  }, "test-model"), { status: "invalid_response", selection: null });
});

test("AI market brief route is protected, responsive, and preserves entitlement gating", async () => {
  const [page, loading, error, css] = await Promise.all([
    readFile(new URL("../app/brief/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/brief/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/brief/error.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mission-control.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /redirect\("\/login"\)/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /MemberEmptyCanvas/);
  assert.match(page, /createProgressiveAccess/);
  assert.doesNotMatch(page, /LockedPremiumCard|buildMarketBrief/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(error, /No market view has been inferred from the failure/);
  assert.match(css, /@media\(max-width:640px\)/);
  assert.match(css, /\.briefHero\{gap:20px/);
});

test("shared member components expose accessible navigation and safe states", async () => {
  const [shell, card, state] = await Promise.all([
    readFile(new URL("../app/components/MemberShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/DashboardCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SafeState.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(shell, /aria-label="Member navigation"/);
  assert.match(shell, /aria-current/);
  assert.match(card, /dailyCard/);
  assert.match(state, /role=\{tone === "danger" \? "alert" : "status"\}/);
});
