import test from "node:test";
import assert from "node:assert/strict";
import { confirmedChartFacts, type ChartConfirmation } from "../app/pocket/chart-preflight.ts";

const recordedPreflight: ChartConfirmation = {
  instrument: "US 500 USD",
  timeframe: "5m",
  currentPrice: "7709.19",
  contextMatch: "MATCHED",
};

test("automatic and older preflight readings cannot override independently verified chart facts", () => {
  assert.equal(confirmedChartFacts(null), null);
  assert.equal(confirmedChartFacts(recordedPreflight), null);
  assert.equal(confirmedChartFacts({ ...recordedPreflight, source: "PREFLIGHT" }), null);
});

test("explicitly confirmed trader corrections retain their exact identity and price", () => {
  const corrected: ChartConfirmation = { ...recordedPreflight, instrument: "US 500 (DFB)", currentPrice: "7708.49", source: "USER_CONFIRMED" };
  assert.deepEqual(confirmedChartFacts(corrected), corrected);
  assert.equal(recordedPreflight.currentPrice, "7709.19");
});
