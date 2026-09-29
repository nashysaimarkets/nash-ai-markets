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
