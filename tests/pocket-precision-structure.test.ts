import test from "node:test";
import assert from "node:assert/strict";
import {
  combineVerifiedBattlefield,
  confirmContextCompatibility,
  contextBattlefieldFromPrecision,
  hasViablePrecisionGeometry,
  hasReusableTwoSidedStructure,
  instrumentIdentitiesMatch,
  normalizeInstrumentIdentifier,
  precisionCoverageDiagnostics,
  precisionGeometryDiagnostics,
  precisionRescueReasons,
  reservePrecisionProviderCall,
  rescueShouldLeadGeometry,
  structuralSideCoverage,
  trustGateForCombinedBattlefield,
  verifiedPrecisionInstrumentIdentifier,
} from "../app/api/pocket/precision-structure.ts";

const completeShield = { status: "NO_VISIBLE_RISK_ZONES", zones: [] };

test("precision provider calls obey both call and remaining-time budgets", () => {
  const budget = { deadlineAt: 10_000, remainingCalls: 2 };
  assert.deepEqual(reservePrecisionProviderCall(budget, 1_000, 2_000), { allowed: true, timeoutMs: 9_000, remainingCalls: 1 });
  assert.deepEqual(reservePrecisionProviderCall(budget, 8_500, 2_000), { allowed: false, reason: "TIME_BUDGET", remainingCalls: 1 });
  assert.equal(budget.remainingCalls, 1, "a skipped retry must not consume the remaining call");
  assert.deepEqual(reservePrecisionProviderCall(budget, 7_000, 2_000), { allowed: true, timeoutMs: 3_000, remainingCalls: 0 });
  assert.deepEqual(reservePrecisionProviderCall(budget, 7_000, 2_000), { allowed: false, reason: "CALL_BUDGET", remainingCalls: 0 });
});

test("an aborted report prevents every later precision reservation without consuming call budget", () => {
  const controller = new AbortController();
  const budget = { deadlineAt: 10_000, remainingCalls: 2, signal: controller.signal };
  assert.equal(reservePrecisionProviderCall(budget, 1_000, 2_000).allowed, true);
  controller.abort(new Error("report_failed"));
  assert.deepEqual(
    reservePrecisionProviderCall(budget, 1_001, 2_000),
    { allowed: false, reason: "REQUEST_ABORTED", remainingCalls: 1 },
  );
  assert.equal(budget.remainingCalls, 1);
});

test("precision diagnostics expose structural state without exact chart prices", () => {
  const coverage = structuralSideCoverage([
    { kind: "support", price: "95" },
    { kind: "resistance", price: "105" },
  ], "100");
  assert.deepEqual(precisionCoverageDiagnostics(coverage), {
    supportBelow: true,
    resistanceAbove: true,
    exactHorizontalLevels: 2,
    twoSided: true,
  });
  const diagnostics = precisionGeometryDiagnostics({
    currentPrice: "100",
    priceScaleAnchors: [{ price: 95, y: 80 }, { price: 105, y: 20 }],
    levels: [{ kind: "support", price: "95" }, { kind: "resistance", price: "105" }],
  });
  assert.equal("currentPrice" in diagnostics.coverage, false);
  assert.doesNotMatch(JSON.stringify(diagnostics), /\b100\b/);
});

test("successful context geometry remains independently available", () => {
  const context = contextBattlefieldFromPrecision({
    instrumentIdentifier: "US 500 (DFB)",
    confidence: "HIGH",
    currentPrice: "101",
    priceScaleAnchors: [{ price: 105, y: 20 }, { price: 100, y: 50 }, { price: 95, y: 80 }],
    plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
    levels: [{ kind: "support", price: "95" }, { kind: "resistance", price: "105" }],
  });
  assert.equal(context?.currentPrice, "101");
  assert.equal(context?.instrumentIdentifier, "US 500 (DFB)");
  assert.equal(context?.levels.length, 2);
  assert.equal(contextBattlefieldFromPrecision(null), null);
  assert.equal(contextBattlefieldFromPrecision({ instrumentIdentifier: "QQQ", confidence: "LOW", levels: [] })?.instrumentIdentifier, "");
  assert.equal(contextBattlefieldFromPrecision({ instrumentIdentifier: "QQQ", confidence: "HIGH", currentPrice: "approx 100", levels: [] })?.currentPrice, "");
});

test("pivots do not satisfy structural coverage on either side", () => {
  const coverage = structuralSideCoverage([
    { kind: "pivot", price: "95" },
    { kind: "pivot", price: "105" },
  ], "100");
  assert.equal(coverage.twoSided, false);
  assert.equal(coverage.exactHorizontalLevels, 0);
  assert.deepEqual(precisionRescueReasons({ currentPrice: "100", levels: [{ kind: "pivot", price: "95" }, { kind: "pivot", price: "105" }], liquidityShield: completeShield }), ["MISSING_STRUCTURAL_SIDE"]);
});

test("a liquidity-only retry cannot take ownership of structural geometry", () => {
  assert.equal(rescueShouldLeadGeometry(["LIQUIDITY_INCOMPLETE"]), false);
  assert.equal(rescueShouldLeadGeometry(["MISSING_STRUCTURAL_SIDE", "LIQUIDITY_INCOMPLETE"]), true);
  assert.equal(rescueShouldLeadGeometry(["GEOMETRY_UNUSABLE"]), true);
});

test("only exact horizontal structure below and above current is two-sided", () => {
  const coverage = structuralSideCoverage([
    { kind: "resistance", price: "95" },
    { kind: "support", price: "105" },
    { kind: "support", price: "100" },
  ], "100");
  assert.deepEqual(coverage, { currentPrice: 100, supportBelow: true, resistanceAbove: true, exactHorizontalLevels: 2, twoSided: true });
  const viable = {
    currentPrice: "100",
    plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
    priceScaleAnchors: [{ price: 105, y: 20 }, { price: 100, y: 50 }, { price: 95, y: 80 }],
    levels: [{ kind: "support", price: "95", y: 80 }, { kind: "resistance", price: "105", y: 20 }],
    liquidityShield: completeShield,
  };
  assert.equal(hasViablePrecisionGeometry(viable), true);
  assert.deepEqual(precisionRescueReasons(viable), []);
});

test("two-sided prices with unusable scale geometry trigger the precision rescue", () => {
  const unusable = {
    currentPrice: "100",
    plotBounds: { left: 0, top: 0, right: 100, bottom: 100 },
    priceScaleAnchors: [{ price: 105, y: .1 }, { price: 100, y: .5 }, { price: 95, y: .9 }],
    levels: [{ kind: "support", price: "95", y: .9 }, { kind: "resistance", price: "105", y: .1 }],
    liquidityShield: completeShield,
  };
  assert.equal(hasViablePrecisionGeometry(unusable), false);
  assert.deepEqual(precisionRescueReasons(unusable), ["GEOMETRY_UNUSABLE"]);
});

test("a raw liquidity zone that fails scale and touch-row validation triggers rescue", () => {
  const value = {
    currentPrice: "100",
    plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
    priceScaleAnchors: [{ price: 105, y: 20 }, { price: 100, y: 50 }, { price: 95, y: 80 }],
    levels: [{ kind: "support", price: "95", y: 80 }, { kind: "resistance", price: "105", y: 20 }],
    liquidityShield: {
      status: "VISIBLE_RISK_ZONES",
      zones: [{
        side: "BELOW_PRICE",
        pattern: "EQUAL_LOWS",
        label: "wrong row",
        priceLow: 95,
        priceHigh: 95,
        confidence: "HIGH",
        evidence: "Claimed lows",
        touchPoints: [{ x: 25, y: 20 }, { x: 70, y: 20 }],
      }],
    },
  };
  assert.deepEqual(precisionRescueReasons(value), ["LIQUIDITY_UNUSABLE"]);
});

test("a rounded at-market quote cannot satisfy a structural side", () => {
  const coverage = structuralSideCoverage([
    { kind: "support", price: "7640" },
    { kind: "resistance", price: "7680" },
  ], "7639.92");
  assert.deepEqual(coverage, {
    currentPrice: 7639.92,
    supportBelow: false,
    resistanceAbove: true,
    exactHorizontalLevels: 1,
    twoSided: false,
  });
});

test("an explicit context match is still rejected when visible current prices conflict", () => {
  assert.deepEqual(confirmContextCompatibility({}, true, "100", "120", true, "US 500", "US-500 (DFB)"), { compatible: false, reason: "PRICE_MISMATCH" });
  assert.deepEqual(confirmContextCompatibility({}, true, "100", "", true, "US 500", "US-500 (DFB)"), { compatible: false, reason: "NOT_CONFIRMED" });
  const matchingReport = { higherTimeframe: { provided: true, alignment: "ALIGNED" }, contextContribution: { used: true } };
  assert.deepEqual(confirmContextCompatibility(matchingReport, true, "100", "", true, "US 500", "US-500 (DFB)"), { compatible: true, reason: "EXPLICIT_MATCH" });
  const conflictingReport = { higherTimeframe: { provided: true, alignment: "CONFLICTING" }, contextContribution: { used: true } };
  assert.deepEqual(confirmContextCompatibility(conflictingReport, true, "100", "101", true, "US 500", "US-500 (DFB)"), { compatible: false, reason: "NOT_CONFIRMED" });
});

test("unconfirmed context needs both report and current-price agreement", () => {
  const report = { higherTimeframe: { provided: true, alignment: "ALIGNED" }, contextContribution: { used: true } };
  assert.deepEqual(confirmContextCompatibility(report, false, "100", "101", true, "GBP/USD (DFB)", "GBP / USD"), { compatible: true, reason: "REPORT_AND_PRICE_MATCH" });
  assert.deepEqual(confirmContextCompatibility(report, false, "100", "", true, "GBP/USD (DFB)", "GBP / USD"), { compatible: false, reason: "NOT_CONFIRMED" });
  assert.deepEqual(confirmContextCompatibility({ ...report, higherTimeframe: { provided: true, alignment: "CONFLICTING" } }, false, "100", "101", true, "GBP/USD (DFB)", "GBP / USD"), { compatible: false, reason: "NOT_CONFIRMED" });
});

test("instrument identity is normalized conservatively and never inferred from price proximity", () => {
  assert.equal(normalizeInstrumentIdentifier("NVIDIA Corp (24 Hours) (DFB)"), "NVIDIA");
  assert.equal(instrumentIdentitiesMatch(["NVDA", "NVIDIA Corp (24 Hours) (DFB)"], "NVIDIA"), true);
  assert.equal(instrumentIdentitiesMatch("UNKNOWN", "NVIDIA"), null);
  assert.equal(instrumentIdentitiesMatch("SPY", "QQQ"), false);
  const report = { higherTimeframe: { provided: true, alignment: "ALIGNED" }, contextContribution: { used: true } };
  assert.deepEqual(
    confirmContextCompatibility(report, true, "100", "104.9", true, ["SPY", "SPDR S&P 500 ETF"], "QQQ"),
    { compatible: false, reason: "IDENTITY_MISMATCH" },
  );
  assert.deepEqual(
    confirmContextCompatibility(report, true, "100", "104.9", true, "", "SPY"),
    { compatible: false, reason: "IDENTITY_MISSING" },
  );
});

test("a high-confidence precision read preserves the complete visible instrument title", () => {
  const qqq = "Invesco QQQ Trust Series 1 (24 Hours) (DFB)";
  assert.equal(verifiedPrecisionInstrumentIdentifier(qqq, "HIGH"), qqq);
  assert.equal(instrumentIdentitiesMatch("Invesco QQQ Trust Series 1 (24 Hours) (D", qqq), true);
  assert.equal(verifiedPrecisionInstrumentIdentifier(qqq, "MEDIUM"), null);
  assert.equal(verifiedPrecisionInstrumentIdentifier("UNKNOWN", "HIGH"), null);
});

test("combined battlefield fills a missing side without copying image geometry", () => {
  const combined = combineVerifiedBattlefield(
    [{ kind: "support", label: "4h floor", price: "95", x: 4, y: 80, x2: 90, y2: 80 }],
    [{ kind: "resistance", label: "30m ceiling", price: "105", x: 8, y: 20, x2: 88, y2: 20 }],
    "100",
    { compatible: true, reason: "EXPLICIT_MATCH" },
  );
  assert.equal(combined.coverage.twoSided, true);
  assert.deepEqual(combined.levels, [
    { kind: "support", label: "4h floor", price: "95", source: "PRIMARY" },
    { kind: "resistance", label: "30m ceiling", price: "105", source: "CONTEXT" },
  ]);
  assert.equal("y" in combined.levels[1], false);
});

test("incompatible context never unlocks or becomes reusable", () => {
  const combined = combineVerifiedBattlefield(
    [{ kind: "support", label: "floor", price: "95" }],
    [{ kind: "resistance", label: "other chart", price: "105" }],
    "100",
    { compatible: false, reason: "NOT_CONFIRMED" },
  );
  const gate = trustGateForCombinedBattlefield({ chartLocked: true, identityLocked: true, reasons: [] }, combined);
  assert.equal(combined.coverage.twoSided, false);
  assert.equal(gate.status, "PARTIAL");
  assert.equal(gate.scaleLocked, false);
  assert.equal(hasReusableTwoSidedStructure({ currentPrice: "100", levels: [{ kind: "pivot", price: "95" }], combinedBattlefield: combined }), false);
});

test("compatible two-sided context structure locks the trust gate and cache predicate", () => {
  const combined = combineVerifiedBattlefield(
    [{ kind: "support", label: "floor", price: "95" }],
    [{ kind: "resistance", label: "ceiling", price: "105" }],
    "100",
    { compatible: true, reason: "REPORT_AND_PRICE_MATCH" },
  );
  const gate = trustGateForCombinedBattlefield({ chartLocked: true, identityLocked: true, reasons: ["chart", "identity", "old level reason"] }, combined);
  assert.equal(gate.status, "LOCKED");
  assert.equal(gate.scaleLocked, true);
  assert.equal(gate.exactLevelCount, 2);
  assert.equal(hasReusableTwoSidedStructure({ currentPrice: "100", levels: [], combinedBattlefield: combined }), true);
});
