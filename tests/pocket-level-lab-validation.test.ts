import test from "node:test";
import assert from "node:assert/strict";
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

test("Level Lab can reuse a verified primary scale when the lab photo scale read is tight", () => {
  const primaryWithScale = {
    ...primary,
    plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
    priceScaleAnchors: [{ price: 110, y: 20 }, { price: 90, y: 80 }],
  };
  const tightLabScale = scan({
    priceScaleReadable: false,
    priceScaleAnchors: [{ price: 109, y: 22 }, { price: 91, y: 78 }],
  });
  const result = validateLevelLabScan(tightLabScale, primaryWithScale);
  assert.equal(result.ok, true);
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
