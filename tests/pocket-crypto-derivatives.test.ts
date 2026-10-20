import test from "node:test";
import assert from "node:assert/strict";
import { crossCheckDerivatives, cryptoBase } from "../app/pocket/crypto-derivatives.ts";

const read = { symbol: "BTCUSDT", readable: true, limitation: "", fundingRate: "-0.01%", openInterestChange: "+3.2%", longShortRatio: "", longLiquidations: "$2m", shortLiquidations: "", period: "24h" };
test("restricts the check to confirmed crypto and the same base asset", () => {
  assert.equal(cryptoBase("Crypto Stocks Index"), null);
  assert.equal(crossCheckDerivatives(read, "US500", "bullish").status, "UNVERIFIED");
  assert.equal(crossCheckDerivatives(read, "ETHUSD", "bullish").status, "UNVERIFIED");
  assert.equal(crossCheckDerivatives({ ...read, readable: false }, "BTCUSD", "bullish").status, "UNVERIFIED");
});
test("shows visible fields and a limited structure comparison", () => {
  const result = crossCheckDerivatives(read, "BTCUSD", "Higher highs and higher lows");
  assert.equal(result.status, "CONTEXT");
  assert.match(result.conflict, /funding rate is negative/);
  assert.equal(result.observations.length, 3);
  assert.equal(crossCheckDerivatives({ ...read, fundingRate: "" }, "BTCUSD", "Higher highs").conflict.includes("No defensible"), true);
  assert.equal(crossCheckDerivatives({ ...read, fundingRate: "", openInterestChange: "", longLiquidations: "" }, "BTCUSD", "bullish").status, "UNVERIFIED");
});

test("ambiguous funding notation and negated structure never produce a directional conflict", () => {
  for (const fundingRate of ["-0,01%", "-0.01% expected", "-0.01% to 0.02%", "-1e2%"])
    assert.match(crossCheckDerivatives({ ...read, fundingRate }, "BTCUSD", "bullish").conflict, /No defensible/);
  for (const structure of ["not bullish", "no uptrend confirmed", "potential bullish move"])
    assert.match(crossCheckDerivatives(read, "BTCUSD", structure).conflict, /No defensible/);
});

test("runtime derivatives validation rejects missing or malformed observations", async () => {
  const { isDerivativesResult } = await import("../app/pocket/crypto-derivatives.ts");
  const good = crossCheckDerivatives(read, "BTCUSD", "bullish");
  assert.equal(isDerivativesResult(good), true);
  assert.equal(isDerivativesResult({ ...good, observations: null }), false);
  assert.equal(isDerivativesResult({ ...good, observations: [12] }), false);
  assert.equal(isDerivativesResult({ ...good, status: "MATCHED" }), false);
});

test("empty or foreign positive derivatives context is held at the client boundary", async () => {
  const { isDerivativesResult } = await import("../app/pocket/crypto-derivatives.ts");
  const good = crossCheckDerivatives(read, "BTCUSD", "bullish");
  assert.equal(isDerivativesResult(good, { ticker: "BTCUSDT" }), true);
  assert.equal(isDerivativesResult(good, { ticker: "ETHUSD" }), false);
  assert.equal(isDerivativesResult({ ...good, observations: [] }), false);
});
