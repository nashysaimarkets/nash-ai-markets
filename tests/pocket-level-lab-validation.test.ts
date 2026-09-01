import test from "node:test";
import assert from "node:assert/strict";
import { calibratePocketAnalysis, verifiedLinearScale } from "../app/api/pocket/analysis-calibration.ts";
import {
  validateLevelLabPrimaryProvenance,
  validateLevelLabScan,
} from "../app/api/pocket/level-lab-validation.ts";

const primary = {
  instrument: "US 500 (DFB)",
  ticker: "US500",
  timeframe: "30m",
  currentPrice: "100",
  identityLocked: true,
} as const;

function scan(overrides: Record<string, unknown> = {}) {
  return {
    instrumentIdentifier: "US 500 (DFB)",
    instrumentConfidence: "HIGH",
    candlesReadable: true,
    priceScaleReadable: true,
    plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
    priceScaleAnchors: [{ price: 110, y: 20 }, { price: 90, y: 80 }],
    levels: [
      { kind: "support", label: "Visible floor", price: "95", x: 5, y: 65, x2: 90, y2: 65 },
      { kind: "resistance", label: "Visible ceiling", price: "105", x: 5, y: 35, x2: 90, y2: 35 },
    ],
    currentPrice: "100.5",
    levelStory: "Both sides align with visible reactions.",
    confidence: "HIGH",
    limitation: "Verify the original chart.",
    ...overrides,
  };
}

test("Level Lab requires locked primary identity and an exact numeric primary price", () => {
  assert.deepEqual(validateLevelLabPrimaryProvenance(primary), primary);
  assert.equal(validateLevelLabPrimaryProvenance({ ...primary, identityLocked: false }), null);
  assert.equal(validateLevelLabPrimaryProvenance({ ...primary, currentPrice: "about 100" }), null);
  assert.equal(validateLevelLabPrimaryProvenance({ ...primary, timeframe: "UNKNOWN" }), null);
});

test("Level Lab rejects oversized primary provenance before scale de-duplication", () => {
  const priceScaleAnchors = Array.from({ length: 90_000 }, (_, index) => ({ price: 100 + index, y: index % 100 }));
  const startedAt = performance.now();
  assert.equal(validateLevelLabPrimaryProvenance({
    ...primary,
    plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
    priceScaleAnchors,
  }), null);
  assert.ok(performance.now() - startedAt < 100, "the oversized array must be rejected in constant time");
});

test("a matching independently verified two-sided scan preserves primary price and Level Lab provenance", () => {
  const result = validateLevelLabScan(scan(), primary);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.levels.currentPrice, primary.currentPrice);
  assert.deepEqual(result.levels.provenance, {
    source: "LEVEL_LAB",
    primaryInstrument: primary.instrument,
    primaryTimeframe: primary.timeframe,
    primaryCurrentPrice: primary.currentPrice,
    levelLabInstrument: "US 500 (DFB)",
  });
  assert.equal((result.levels.levels as Array<{ source?: string }>).length, 2);
  assert.equal((result.levels.levels as Array<{ source?: string }>).every((level) => level.source === "LEVEL_LAB"), true);
  assert.deepEqual(result.levels.trustGate, {
    status: "LOCKED",
    chartLocked: true,
    identityLocked: true,
    scaleLocked: true,
    exactLevelCount: 2,
    reasons: [
      "Candles and structure are readable",
      "Instrument and timeframe are verified",
      "2 exact structural levels bracket current price",
      "No explicit contradiction was returned",
    ],
    nextAction: "Verify the marked prices on the original chart before acting.",
  });
});

test("a validated Level Lab map atomically replaces a stale HOLD gate with its fresh LOCKED gate", () => {
  const original = { trustGate: { status: "HOLD", chartLocked: true, identityLocked: true, scaleLocked: false } };
  const result = validateLevelLabScan(scan(), primary);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const updated = { ...original, levels: result.levels.levels, trustGate: result.levels.trustGate };
  assert.equal((updated.trustGate as Record<string, unknown>).status, "LOCKED");
  assert.equal((updated.trustGate as Record<string, unknown>).scaleLocked, true);
});

test("an unverified Level Lab result supplies no replacement gate, leaving the held result untouched", () => {
  const original = { trustGate: { status: "HOLD", chartLocked: true, identityLocked: true, scaleLocked: false } };
  const result = validateLevelLabScan(scan({ currentPrice: "120" }), primary);
  assert.equal(result.ok, false);
  assert.deepEqual(original.trustGate, { status: "HOLD", chartLocked: true, identityLocked: true, scaleLocked: false });
});

test("Level Lab rejects an unreadable or mismatched instrument", () => {
  assert.deepEqual(validateLevelLabScan(scan({ instrumentConfidence: "UNKNOWN", instrumentIdentifier: "UNKNOWN" }), primary), {
    ok: false,
    reason: "INSTRUMENT_UNREADABLE",
  });
  assert.deepEqual(validateLevelLabScan(scan({ instrumentIdentifier: "US Tech 100 (DFB)" }), primary), {
    ok: false,
    reason: "INSTRUMENT_MISMATCH",
  });
});

test("Level Lab treats its current price as a compatibility check, never a replacement", () => {
  assert.deepEqual(validateLevelLabScan(scan({ currentPrice: "100-ish" }), primary), {
    ok: false,
    reason: "CURRENT_PRICE_UNREADABLE",
  });
  assert.deepEqual(validateLevelLabScan(scan({ currentPrice: "120" }), primary), {
    ok: false,
    reason: "CURRENT_PRICE_MISMATCH",
  });
});

test("Level Lab rejects unreadable candles and an unverified scale", () => {
  assert.deepEqual(validateLevelLabScan(scan({ candlesReadable: false }), primary), {
    ok: false,
    reason: "CANDLES_UNREADABLE",
  });
  assert.deepEqual(validateLevelLabScan(scan({ priceScaleAnchors: [{ price: 100, y: 50 }] }), primary), {
    ok: false,
    reason: "PRICE_SCALE_UNVERIFIED",
  });
  assert.deepEqual(validateLevelLabScan(scan({
    priceScaleAnchors: [{ price: 90, y: 80 }, { price: 100, y: 50 }, { price: 110, y: 70 }],
  }), primary), {
    ok: false,
    reason: "PRICE_SCALE_UNVERIFIED",
  });
});

test("Level Lab fails closed when one anchor is fractional and one is percentage-based", () => {
  const result = validateLevelLabScan(scan({
    plotBounds: { left: 0, top: 0, right: 100, bottom: 100 },
    priceScaleAnchors: [{ price: 110, y: .2 }, { price: 90, y: 80 }],
    levels: [
      { kind: "support", label: "False floor", price: "95", x: 0, y: 60.05, x2: 100, y2: 60.05 },
      { kind: "resistance", label: "False ceiling", price: "105", x: 0, y: 20.15, x2: 100, y2: 20.15 },
    ],
  }), primary);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "PRICE_SCALE_UNVERIFIED");
});

test("Level Lab uses its own consistent scale when the model's readability flag is conservative", () => {
  const primaryWithScale = {
    ...primary,
    plotBounds: { left: 25, top: 10, right: 75, bottom: 90 },
    priceScaleAnchors: [{ price: 1000, y: 20 }, { price: 900, y: 80 }],
  };
  const tightLabScale = scan({
    priceScaleReadable: false,
    priceScaleAnchors: [{ price: 109, y: 22 }, { price: 91, y: 78 }],
  });
  const result = validateLevelLabScan(tightLabScale, primaryWithScale);
  assert.equal(result.ok, true);
});

const chartBenchmarkFixtures = [
  {
    name: "US500 30m range",
    instrument: "US 500 (DFB)",
    ticker: "US500",
    timeframe: "30m",
    current: "7658",
    anchors: [{ price: 7690, y: 34 }, { price: 7670, y: 54 }, { price: 7650, y: 74 }],
    levels: [
      { kind: "support", label: "Visible floor", price: "7650", x: 5, y: 74, x2: 88, y2: 74 },
      { kind: "resistance", label: "Visible ceiling", price: "7680", x: 5, y: 44, x2: 88, y2: 44 },
    ],
  },
  {
    name: "US500 4h structure",
    instrument: "US 500 (DFB)",
    ticker: "US500",
    timeframe: "4h",
    current: "7658",
    anchors: [{ price: 7800, y: 22 }, { price: 7650, y: 46 }, { price: 7500, y: 70 }],
    levels: [
      { kind: "support", label: "Visible floor", price: "7600", x: 5, y: 54, x2: 88, y2: 54 },
      { kind: "resistance", label: "Visible ceiling", price: "7800", x: 5, y: 22, x2: 88, y2: 22 },
    ],
  },
  {
    name: "decimal equity",
    instrument: "AAPL",
    ticker: "AAPL",
    timeframe: "15m",
    current: "123.45",
    anchors: [{ price: 126, y: 20 }, { price: 123, y: 50 }, { price: 120, y: 80 }],
    levels: [
      { kind: "support", label: "Visible floor", price: "122.50", x: 5, y: 55, x2: 88, y2: 55 },
      { kind: "resistance", label: "Visible ceiling", price: "125.25", x: 5, y: 27.5, x2: 88, y2: 27.5 },
    ],
  },
] as const;

for (const sample of chartBenchmarkFixtures) {
  test(`Level Lab preserves both sides from the chart-benchmark fixture: ${sample.name}`, () => {
    const result = validateLevelLabScan(scan({
      instrumentIdentifier: sample.instrument,
      plotBounds: { left: 5, top: 10, right: 88, bottom: 88 },
      priceScaleAnchors: [...sample.anchors],
      currentPrice: sample.current,
      levels: sample.levels.map((level) => ({ ...level })),
    }), {
      instrument: sample.instrument,
      ticker: sample.ticker,
      timeframe: sample.timeframe,
      currentPrice: sample.current,
      identityLocked: true,
    });
    assert.equal(result.ok, true, `${sample.name} should still return a usable Level Lab map`);
    if (!result.ok) return;
    const levels = result.levels.levels as Array<{ kind: string; price: string }>;
    assert.ok(levels.some((level) => level.kind === "support" && level.price === sample.levels[0].price));
    assert.ok(levels.some((level) => level.kind === "resistance" && level.price === sample.levels[1].price));
    assert.equal((result.levels.trustGate as { status?: string })?.status, "LOCKED");
  });
}

test("a readable tight two-label mobile Level Lab scale still returns the US500 30m support and resistance", () => {
  // Same prices as the US500 30m chart-benchmark fixture, with only the two
  // outer axis labels visible 16% apart — typical of a zoomed mobile screenshot.
  const tightAnchors = [{ price: 7690, y: 34 }, { price: 7650, y: 50 }];
  assert.equal(verifiedLinearScale(tightAnchors), null, "the global primary-read checker must stay strict");
  const global = calibratePocketAnalysis({
    currentPrice: "7658",
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, scaleReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH" },
    plotBounds: { left: 5, top: 10, right: 88, bottom: 88 },
    priceScaleAnchors: tightAnchors,
    levels: [
      { kind: "support", price: "7650", y: 50 },
      { kind: "resistance", price: "7680", y: 38 },
    ],
  }) as { levels: Array<{ price: string }>; trustGate?: { status?: string } };
  assert.equal(global.levels.every((level) => !level.price), true, "global calibration must not keep unverified exact prices");
  assert.notEqual(global.trustGate?.status, "LOCKED");

  const result = validateLevelLabScan(scan({
    instrumentIdentifier: "US 500 (DFB)",
    plotBounds: { left: 5, top: 10, right: 88, bottom: 88 },
    priceScaleAnchors: tightAnchors,
    currentPrice: "7658",
    levels: [
      { kind: "support", label: "Visible floor", price: "7650", x: 5, y: 50, x2: 88, y2: 50 },
      { kind: "resistance", label: "Visible ceiling", price: "7680", x: 5, y: 38, x2: 88, y2: 38 },
    ],
  }), {
    instrument: "US 500 (DFB)",
    ticker: "US500",
    timeframe: "30m",
    currentPrice: "7658",
    identityLocked: true,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const levels = result.levels.levels as Array<{ kind: string; price: string }>;
  assert.deepEqual(levels.map((level) => [level.kind, level.price]), [
    ["support", "7650"],
    ["resistance", "7680"],
  ]);
});

test("Level Lab keeps exact levels when a third axis label has small mobile vision jitter", () => {
  const jittered = [{ price: 90, y: 80 }, { price: 100, y: 47 }, { price: 110, y: 20 }];
  assert.equal(verifiedLinearScale(jittered), null, "3.0px axis jitter must still fail the global checker");
  const result = validateLevelLabScan(scan({
    priceScaleAnchors: jittered,
    levels: [
      { kind: "support", label: "Visible floor", price: "95", x: 5, y: 65, x2: 90, y2: 65 },
      { kind: "resistance", label: "Visible ceiling", price: "105", x: 5, y: 35, x2: 90, y2: 35 },
    ],
  }), primary);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const levels = result.levels.levels as Array<{ kind: string; price: string }>;
  assert.deepEqual(levels.map((level) => [level.kind, level.price]), [
    ["support", "95"],
    ["resistance", "105"],
  ]);
});

test("a clearly non-linear three-label scale still fails closed and does not invent prices", () => {
  // Existing precision-fallback fixture: the middle label is 13% off a linear axis.
  assert.deepEqual(validateLevelLabScan(scan({
    plotBounds: { left: 5, top: 10, right: 88, bottom: 88 },
    priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7650, y: 37 }, { price: 7500, y: 80 }],
    currentPrice: "7658",
    levels: [
      { kind: "support", label: "Visible floor", price: "7600", x: 5, y: 60, x2: 88, y2: 60 },
      { kind: "resistance", label: "Visible ceiling", price: "7750", x: 5, y: 30, x2: 88, y2: 30 },
    ],
  }), {
    instrument: "US 500 (DFB)",
    ticker: "US500",
    timeframe: "30m",
    currentPrice: "7658",
    identityLocked: true,
  }), {
    ok: false,
    reason: "PRICE_SCALE_UNVERIFIED",
  });
});

test("Level Lab rejects levels that do not align with verified candle rows", () => {
  const badGeometry = scan({
    levels: [
      { kind: "support", label: "Wrong row", price: "95", x: 5, y: 15, x2: 90, y2: 15 },
      { kind: "resistance", label: "Visible ceiling", price: "105", x: 5, y: 35, x2: 90, y2: 35 },
    ],
  });
  assert.deepEqual(validateLevelLabScan(badGeometry, primary), {
    ok: false,
    reason: "GEOMETRY_UNVERIFIED",
  });
});

test("Level Lab rejects one-sided structure even when multiple levels pass geometry", () => {
  const oneSided = scan({
    levels: [
      { kind: "support", label: "Floor one", price: "95", x: 5, y: 65, x2: 90, y2: 65 },
      { kind: "support", label: "Floor two", price: "97", x: 5, y: 59, x2: 90, y2: 59 },
    ],
  });
  assert.deepEqual(validateLevelLabScan(oneSided, primary), {
    ok: false,
    reason: "ONE_SIDED_STRUCTURE",
  });
});
