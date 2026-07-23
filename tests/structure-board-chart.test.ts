import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("structure board mounts clickable cards and verified candle chart panel", async () => {
  const [board, terminal, styles] = await Promise.all([
    read("../app/terminal/components/MarketStructureBoardPanel.tsx"),
    read("../app/terminal/page.tsx"),
    read("../app/mission-control.css"),
  ]);
  assert.match(board, /"use client"/);
  assert.match(board, /DashboardCandlestickChart/);
  assert.match(board, /aria-pressed=\{isSelected\}/);
  assert.match(board, /No OHLC \/ candles unavailable/);
  assert.match(board, /Bullseye will not invent candles/);
  assert.match(board, /defaultSelection/);
  assert.match(terminal, /MarketStructureBoardPanel/);
  assert.match(terminal, /seriesByInstrument=\{candleSeriesByInstrument\}/);
  assert.doesNotMatch(terminal, /MarketDirectionalGaugesPanel/);
  assert.match(styles, /\.ctStructureBoardChart\{[^}]*grid-column:5 \/ span 2/);
  assert.match(styles, /\.ctStructureBoardCard\.is-selected/);
});
