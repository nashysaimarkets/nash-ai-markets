import assert from "node:assert/strict";
import test from "node:test";
import { MARKET_BOARD_LABELS, MARKET_BOARD_SYMBOLS } from "../app/lib/market-board-instruments.ts";
import { getMarketInstrument } from "../app/lib/markets/market-catalog.ts";
import {
  candleInstrumentLabel,
  providerSymbolForInstrument,
  resolveCandleInstrumentMeta,
} from "../app/lib/providers/candle-instruments.ts";
import { DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS } from "../app/lib/providers/financial-modeling-prep.ts";
import { groupVerifiedEvents } from "../app/terminal/lib/event-display.ts";

test("Nasdaq Composite maps to IXIC /^IXIC and never uses futures ticker NQ", () => {
  assert.ok(MARKET_BOARD_SYMBOLS.includes("IXIC"));
  assert.equal(MARKET_BOARD_LABELS.IXIC, "Nasdaq Composite");
  assert.equal(DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS.nasdaq, "^IXIC");
  assert.equal(providerSymbolForInstrument("IXIC"), "^IXIC");
  assert.equal(resolveCandleInstrumentMeta("IXIC").instrumentName, "Nasdaq Composite");
  assert.equal(candleInstrumentLabel("IXIC"), "Nasdaq Composite");
  assert.match(resolveCandleInstrumentMeta("IXIC").instrumentDetail, /never treated as live Nasdaq-100 futures \(NQ\)/i);

  const live = getMarketInstrument("ixic");
  assert.equal(live?.symbol, "IXIC");
  assert.equal(live?.name, "Nasdaq Composite");
  assert.equal(live?.providerSymbol, "^IXIC");
  assert.equal(live?.coverage, "live");

  // Legacy favourite id still resolves to Composite, not futures.
  assert.equal(getMarketInstrument("nq")?.id, "ixic");
  assert.equal(getMarketInstrument("nq-futures")?.symbol, "NQ");
  assert.equal(getMarketInstrument("nq-futures")?.coverage, "awaiting");
  assert.doesNotMatch(getMarketInstrument("ixic")?.name ?? "", /E-mini/i);
});

test("Employment Cost components group under one primary catalyst window", () => {
  const now = Date.parse("2026-07-30T12:00:00.000Z");
  const at = "2026-07-30T13:30:00.000Z";
  const groups = groupVerifiedEvents([
    { time: "Wed 14:30", name: "Employment Cost – Wages QoQ", risk: "MED", at },
    { time: "Wed 14:30", name: "Employment Cost Index QoQ", risk: "MED", at },
    { time: "Wed 14:30", name: "Employment Cost – Benefits QoQ", risk: "MED", at },
    { time: "Thu 15:00", name: "Consumer Sentiment", risk: "MED", at: "2026-07-31T14:00:00.000Z" },
  ], now, 5);

  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.name, "Employment Cost Index QoQ");
  assert.deepEqual(
    groups[0]?.includes.map((item) => item.name).sort(),
    ["Benefits QoQ", "Wages QoQ"],
  );
  assert.equal(groups[1]?.name, "Consumer Sentiment");
  assert.equal(groups[1]?.includes.length, 0);
});
