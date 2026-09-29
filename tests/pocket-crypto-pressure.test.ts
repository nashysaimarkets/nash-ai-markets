import test from "node:test";
import assert from "node:assert/strict";
import { cryptoPair, interpretCryptoPanel } from "../app/pocket/crypto-pressure.ts";

const read = { pair: "BTC/USD", timeframe: "24h", readable: true, limitation: "", fundingRatePct: .04,
  openInterestChangePct: 8, longShortRatio: 1.8, longLiquidations: 100, shortLiquidations: 20,
  clusters: [{ side: "LONG" as const, price: 70020 }] };

test("allows explicit crypto pairs but never an index or guessed asset", () => {
  assert.equal(cryptoPair("BTC/USD"), "BTCUSD");
  assert.equal(cryptoPair("BINANCE:ETHUSDT"), "ETHUSDT");
  assert.equal(cryptoPair("US 500 DFB"), null);
  assert.equal(cryptoPair("Bitcoin"), null);
});

test("reports observed crowding and nearby cluster without directional signal", () => {
  const result = interpretCryptoPanel(read, "BTCUSD", [{ kind: "support", price: "70,000" }], "BEARISH");
  assert.equal(result.status, "VERIFIED");
  assert.equal(result.overlap.length, 1);
  assert.match(result.conflict, /conflicts with Bullseye's bearish chart read/);
  assert.match(result.caution, /Neither predicts/);
});

test("holds mismatched pairs, missing timeframe and absent observations", () => {
  assert.equal(interpretCryptoPanel(read, "ETHUSD", [], "NEUTRAL").status, "UNVERIFIED");
  assert.equal(interpretCryptoPanel({ ...read, timeframe: "" }, "BTCUSD", [], "NEUTRAL").status, "UNVERIFIED");
  assert.equal(interpretCryptoPanel({ ...read, fundingRatePct: null, openInterestChangePct: null, longShortRatio: null, longLiquidations: null, shortLiquidations: null, clusters: [] }, "BTCUSD", [], "NEUTRAL").status, "UNVERIFIED");
});
