import assert from "node:assert/strict";
import test from "node:test";
import { createMarketStructureLevels } from "../app/lib/market-structure-levels.ts";
import { MARKET_BOARD_SYMBOLS } from "../app/lib/market-board-instruments.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";
import type { OhlcvPoint } from "../app/terminal/lib/visual-terminal.ts";

function liveSnapshot(): MarketSnapshot {
  return {
    status: "LIVE",
    source: "fixture",
    asOf: new Date().toISOString(),
    quotes: [
      { symbol: "ES", label: "ES", value: "100", change: "+0.40%", direction: "up" },
      { symbol: "VIX", label: "VIX", value: "14.2", change: "-3.10%", direction: "down" },
      { symbol: "US2Y", label: "2Y", value: "4.20%", change: "—", direction: "flat" },
      { symbol: "US10Y", label: "10Y", value: "4.40%", change: "—", direction: "flat" },
      { symbol: "DXY", label: "DXY", value: "97.8", change: "-0.20%", direction: "down" },
      { symbol: "OIL", label: "OIL", value: "72.4", change: "+1.10%", direction: "up" },
      { symbol: "QQQ", label: "QQQ", value: "485.2", change: "+0.80%", direction: "up" },
      { symbol: "NQ", label: "NASDAQ", value: "17850", change: "+0.70%", direction: "up" },
    ],
    levels: [],
    events: [],
    bias: "BULLISH",
    risk: "MODERATE",
    summary: "fixture",
    evidence: {},
  };
}

function candles(base = 100): OhlcvPoint[] {
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: 30 }, (_, index) => {
    const time = now - (29 - index) * 300;
    const open = base + index * 0.1;
    const close = open + 0.2;
    return {
      time,
      open,
      high: close + 0.5,
      low: open - 0.5,
      close,
      volume: 1000 + index,
    };
  });
}

test("structure levels derive support/resistance from verified candles and fail closed otherwise", () => {
  const snapshot = liveSnapshot();
  const series = candles(100);
  const levels = createMarketStructureLevels({
    snapshot,
    candlesBySymbol: {
      ES: series,
      VIX: candles(14),
      DXY: candles(98),
      OIL: candles(70),
      QQQ: candles(480),
      NQ: candles(17000),
    },
  });

  assert.equal(levels.instruments.length, MARKET_BOARD_SYMBOLS.length);
  const es = levels.instruments.find((item) => item.symbol === "ES");
  assert.equal(es?.status, "ready");
  assert.ok(es?.support && es.resistance);
  assert.ok(es!.resistance!.value > es!.support!.value);
  assert.match(es!.support!.label, /24-hour low \/ downside reference/);
  assert.match(es!.resistance!.label, /24-hour high \/ upside reference/);
  assert.ok(es!.references.some((ref) => ref.kind === "ema20"));

  const treasury = levels.instruments.find((item) => item.symbol === "US2Y");
  assert.equal(treasury?.status, "insufficient");
  assert.equal(treasury?.scalarOnly, true);
  assert.equal(treasury?.support, null);

  const missing = createMarketStructureLevels({ snapshot, candlesBySymbol: {} });
  assert.ok(missing.instruments.filter((item) => !item.scalarOnly).every((item) => item.status === "insufficient"));
  assert.match(levels.disclosure, /Interpretive educational desk levels/);
});
