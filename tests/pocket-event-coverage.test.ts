import assert from "node:assert/strict";
import test from "node:test";
import { classifyEventAsset, eventCoverageFor, isListedEquityEventInput } from "../app/pocket/event-coverage.ts";

const verified = (instrument: string, ticker: string) => ({
  instrument,
  ticker,
  evidenceQuality: { instrumentConfidence: "HIGH" as const },
});

test("company calendars attach only to verified listed-company symbols", () => {
  assert.equal(isListedEquityEventInput(verified("Apple Inc", "AAPL")), true);
  assert.equal(isListedEquityEventInput(verified("EUR / U.S. Dollar", "EURUSD")), false);
  assert.equal(isListedEquityEventInput(verified("US 500 (DFB)", "SPX")), false);
  assert.equal(isListedEquityEventInput(verified("Bitcoin / U.S. Dollar", "BTCUSD")), false);
});

test("event coverage classifies common cross-asset symbols conservatively", () => {
  assert.equal(classifyEventAsset(verified("Gold", "XAUUSD")), "COMMODITY");
  assert.equal(classifyEventAsset(verified("E-mini S&P 500 Futures", "ES")), "FUTURES");
  assert.equal(classifyEventAsset(verified("US 10Y Treasury Yield", "US10Y")), "RATES");
  assert.equal(classifyEventAsset(verified("Invesco QQQ Trust", "QQQ")), "INDEX_OR_ETF");
  assert.equal(classifyEventAsset(verified("US 500 (DFB)", "UNKNOWN")), "INDEX_OR_ETF");
  assert.equal(classifyEventAsset({ instrument: "US 500 (DFB)", ticker: "UNKNOWN", evidenceQuality: { instrumentConfidence: "MEDIUM" } }), "INDEX_OR_ETF");
});

test("every symbol receives truthful US macro coverage with explicit gaps", () => {
  const usdPair = eventCoverageFor(verified("GBP / USD", "GBPUSD"));
  assert.match(usdPair.summary, /USD side/i);
  assert.match(usdPair.limitation ?? "", /Non-US central-bank/i);

  const crypto = eventCoverageFor(verified("Solana", "SOLUSD"));
  assert.match(crypto.summary, /US macro/i);
  assert.match(crypto.limitation ?? "", /Token, protocol/i);

  const unreadable = eventCoverageFor({ instrument: "UNKNOWN", ticker: "UNKNOWN", evidenceQuality: { instrumentConfidence: "UNKNOWN" } });
  assert.equal(unreadable.assetClass, "UNKNOWN");
  assert.equal(unreadable.attachCompanyCalendar, false);
});
