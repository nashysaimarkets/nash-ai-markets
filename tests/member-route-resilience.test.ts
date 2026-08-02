import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { sanitizeForClient, finiteNumber } from "../app/lib/serialize-for-client.ts";
import {
  validateCandleIntegrity,
  validatePercentChange,
  validateUpcomingCatalyst,
  validateSymbolIdentity,
} from "../app/lib/data-integrity.ts";
import { buildDeskDecisionPresentation } from "../app/terminal/lib/desk-decision-presentation.ts";
import { buildPremiumConfidence } from "../app/lib/ai-market-insight.ts";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createUnavailableSnapshot, type MarketSnapshot } from "../app/lib/market-data.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("sanitizeForClient converts NaN and Infinity to null for Flight safety", () => {
  const cleaned = sanitizeForClient({
    score: Number.NaN,
    volume: Number.POSITIVE_INFINITY,
    ok: 12.5,
    nested: { bad: Number.NaN },
  });
  assert.equal(cleaned.score, null);
  assert.equal(cleaned.volume, null);
  assert.equal(cleaned.ok, 12.5);
  assert.equal(cleaned.nested.bad, null);
  assert.equal(finiteNumber(Number.NaN), null);
  assert.equal(finiteNumber(42), 42);
});

test("data integrity quarantines inconsistent candles and expired catalysts", () => {
  const { accepted, issues } = validateCandleIntegrity([
    { time: 1_700_000_000, open: 10, high: 12, low: 9, close: 11 },
    { time: 1_700_000_300, open: 10, high: 8, low: 9, close: 11 },
    { time: Math.floor(Date.now() / 1000) + 10_000, open: 1, high: 2, low: 0.5, close: 1.5 },
  ]);
  assert.equal(accepted.length, 1);
  assert.ok(issues.some((issue) => /High below low/i.test(issue.reason)));
  assert.ok(issues.some((issue) => /ahead of clock/i.test(issue.reason)));
  assert.ok(validatePercentChange(10, 100, 20));
  assert.equal(validatePercentChange(10, 100, 10), null);
  assert.ok(validateUpcomingCatalyst("2020-01-01T00:00:00.000Z"));
  assert.equal(validateUpcomingCatalyst(new Date(Date.now() + 60_000).toISOString()), null);
  assert.ok(validateSymbolIdentity({ symbol: "IXIC", displayName: "Nasdaq-100 futures" }));
  assert.equal(validateSymbolIdentity({ symbol: "IXIC", displayName: "Nasdaq Composite" }), null);
});

test("incomplete confidence never presents a genuine 0/100 customer score", () => {
  const snapshot = createUnavailableSnapshot();
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: "offline",
    dataAgeMs: null,
    fallbackActive: true,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  decision.confidenceScore = 0;
  decision.tradePermission = "no-trade";
  decision.marketBias = "bullish";
  const presentation = buildDeskDecisionPresentation({
    decision,
    plan: null,
    signals: {
      overallLean: "buying",
      buying: { drivers: ["ES higher"], score: 1 },
      selling: { drivers: [], score: 0 },
      schemaVersion: "1.0",
      contextNotes: [],
      disclosure: "",
    } as never,
    warnings: ["Confirmation data is incomplete"],
  });
  assert.equal(presentation.permissionLabel, "WAIT FOR CONFIRMATION");
  assert.equal(presentation.confidenceLabel, "NOT ESTABLISHED");
  assert.doesNotMatch(presentation.confidenceDetail ?? "", /0 \/ 100/);
  assert.doesNotMatch(presentation.permissionLabel, /Restricted/i);

  const confidence = buildPremiumConfidence(decision, intelligence, false);
  assert.equal(confidence.available, false);
  assert.equal(confidence.score, null);
});

test("dashboard and brief pages harden shared context and Flight sanitization", async () => {
  const [dashboard, brief, desk, terminal] = await Promise.all([
    read("../app/dashboard/page.tsx"),
    read("../app/brief/page.tsx"),
    read("../app/terminal/components/TradingDeskOS.tsx"),
    read("../app/terminal/page.tsx"),
  ]);
  assert.match(dashboard, /getVerifiedMarketContext/);
  assert.match(dashboard, /sanitizeForClient/);
  assert.match(dashboard, /dashPartialBanner|Partial verified context|recovered in safe mode/);
  assert.match(brief, /getVerifiedMarketContext/);
  assert.match(brief, /sanitizeForClient/);
  assert.match(brief, /optional AI selection failed|generateAIMarketBriefSelection/);
  assert.match(desk, /More markets — coming later/);
  assert.doesNotMatch(desk, /Additional markets — planned/);
  assert.match(terminal, /sanitizeForClient/);
});

test("premium confidence rejects non-finite engine scores", () => {
  const snapshot: MarketSnapshot = {
    ...createUnavailableSnapshot(),
    status: "DELAYED",
    quotes: [{ symbol: "ES", label: "ES", value: "1", change: "+1", direction: "up" }],
  };
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: "connected",
    dataAgeMs: 1_000,
    fallbackActive: false,
    missingDataWarnings: [],
  });
  (decision as { confidenceScore: number }).confidenceScore = Number.NaN;
  const model = buildPremiumConfidence(decision, intelligence, true);
  assert.equal(model.score, null);
  assert.equal(model.available, false);
});
