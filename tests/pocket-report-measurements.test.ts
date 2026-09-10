import test from "node:test";
import assert from "node:assert/strict";
import { cachedReportMeasurements } from "../app/api/pocket/report-measurements";
const value = {
  instrumentIdentifier: "TEST", currentPrice: "100",
  plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
  priceScaleAnchors: [{ price: 105, y: 20 }, { price: 100, y: 50 }, { price: 95, y: 80 }],
  levels: [{ kind: "support", price: "95", y: 80 }, { kind: "resistance", price: "105", y: 20 }],
  liquidityShield: { status: "NO_VISIBLE_RISK_ZONES", summary: "No cluster", stopGuidance: "Wait", zones: [] },
};
test("verified measurements preserve their source role and exact prices without sending receipt tokens", () => {
  const raw = JSON.stringify({...value, signedToken: "must not be sent"});
  const result = cachedReportMeasurements(raw, raw, null);
  assert.deepEqual(result.map(item => item.role), ["PRIMARY", "HIGHER_TIMEFRAME"]);
  assert.equal(result[0].currentPrice, "100"); assert.deepEqual(result[0].levels, value.levels);
  assert.ok(!JSON.stringify(result).includes("must not be sent"));
  assert.equal(cachedReportMeasurements(null, raw, null)[0].role, "HIGHER_TIMEFRAME");
});
test("missing, malformed or unusable cached geometry cannot guide the report", () => {
  assert.deepEqual(cachedReportMeasurements(null, null, null), []);
  assert.deepEqual(cachedReportMeasurements("not json", "null", null), []);
  assert.deepEqual(cachedReportMeasurements(JSON.stringify({...value, levels: []}), null, null), []);
  assert.deepEqual(cachedReportMeasurements(JSON.stringify({...value, priceScaleAnchors: []}), null, null), []);
});
