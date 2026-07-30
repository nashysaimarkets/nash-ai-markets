import assert from "node:assert/strict";
import test from "node:test";
import { MARKET_BOARD_LABELS, MARKET_BOARD_SYMBOLS } from "../app/lib/market-board-instruments.ts";
import {
  MARKET_CATALOG,
  getMarketInstrument,
  groupAvailabilityLabel,
  isFavouriteMarketId,
} from "../app/lib/markets/market-catalog.ts";
import {
  candleInstrumentLabel,
  providerSymbolForInstrument,
  resolveCandleInstrumentMeta,
} from "../app/lib/providers/candle-instruments.ts";
import { DEFAULT_FINANCIAL_MODELING_PREP_SYMBOLS } from "../app/lib/providers/financial-modeling-prep.ts";
import { createCatalystRadar } from "../app/terminal/lib/catalyst-radar.ts";
import { groupVerifiedEvents } from "../app/terminal/lib/event-display.ts";
import { describeRangePosition } from "../app/lib/range-position-display.ts";

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
  assert.equal(groups[0]?.name, "Employment Cost Index");
  assert.deepEqual(
    groups[0]?.includes.map((item) => item.name).sort(),
    ["Benefits QoQ", "Wages QoQ"],
  );
  assert.equal(groups[1]?.name, "Consumer Sentiment");
  assert.equal(groups[1]?.includes.length, 0);
});

test("catalyst radar and next-event selector stay grouped for the same Employment Cost release", () => {
  const now = Date.parse("2026-07-30T12:00:00.000Z");
  const at = "2026-07-30T13:30:00.000Z";
  const events = [
    { time: "Wed 14:30", name: "Employment Cost – Wages QoQ", risk: "MED" as const, at },
    { time: "Wed 14:30", name: "Employment Cost Index QoQ", risk: "MED" as const, at },
    { time: "Wed 14:30", name: "Employment Cost – Benefits QoQ", risk: "MED" as const, at },
  ];
  const radar = createCatalystRadar({
    events,
    active: getMarketInstrument("es")!,
    favourites: [getMarketInstrument("es")!],
    now,
  });
  assert.equal(radar.items.length, 1);
  assert.equal(radar.items[0]?.title, "Employment Cost Index");
  assert.deepEqual(radar.items[0]?.includes.sort(), ["Benefits QoQ", "Wages QoQ"]);
});

test("group availability labels never imply planned catalogue totals are selectable", () => {
  const fx = MARKET_CATALOG.find((group) => group.id === "fx")!;
  const indices = MARKET_CATALOG.find((group) => group.id === "indices")!;
  assert.equal(groupAvailabilityLabel(fx), "coming later");
  assert.match(groupAvailabilityLabel(indices), /\d+ available/);
  assert.equal(isFavouriteMarketId(["nq", "es"], "ixic"), true);
  assert.equal(isFavouriteMarketId(["es"], "ixic"), false);
});

test("range position display explains quotes outside the verified high/low", () => {
  const above = describeRangePosition(110, 90, 100);
  assert.equal(above.displayPct, 100);
  assert.equal(above.outside, "above");
  assert.match(above.note ?? "", /above the verified 24-hour high/i);

  const below = describeRangePosition(80, 90, 100);
  assert.equal(below.displayPct, 0);
  assert.equal(below.outside, "below");

  const inside = describeRangePosition(95, 90, 100);
  assert.equal(inside.displayPct, 50);
  assert.equal(inside.outside, null);
  assert.equal(inside.note, null);
});
