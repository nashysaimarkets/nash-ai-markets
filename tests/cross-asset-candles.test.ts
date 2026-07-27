import assert from "node:assert/strict";
import test from "node:test";
import {
  candleInstrumentLabel,
  candleSupportNote,
  isCandleInstrument,
  providerSymbolForInstrument,
} from "../app/lib/providers/candle-instruments.ts";

test("candle instruments map to configured provider symbols without inventing series", () => {
  assert.equal(isCandleInstrument("ES"), true);
  assert.equal(isCandleInstrument("US10Y"), false);
  assert.equal(providerSymbolForInstrument("ES"), process.env.FMP_SP500_FUTURES_SYMBOL?.trim() || "ESUSD");
  assert.equal(providerSymbolForInstrument("VIX"), process.env.FMP_VIX_SYMBOL?.trim() || "^VIX");
  assert.equal(providerSymbolForInstrument("DXY"), process.env.FMP_US_DOLLAR_INDEX_SYMBOL?.trim() || "DX-Y.NYB");
  assert.equal(candleInstrumentLabel("DXY"), "US Dollar Index");
});

test("treasury feeds honestly decline OHLC candles", () => {
  assert.match(candleSupportNote("US2Y") ?? "", /Treasury yields/);
  assert.equal(candleSupportNote("ES"), null);
});

test("candles API accepts instrument query parameter", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../app/api/market/candles/route.ts", import.meta.url), "utf8"),
  );
  assert.match(source, /instrument/);
  assert.match(source, /isCandleInstrument/);
});

test("terminal and dashboard mount cross-asset candle gallery", async () => {
  const { readFile } = await import("node:fs/promises");
  const [terminal, dashboard, brief, gallery] = await Promise.all([
    readFile(new URL("../app/terminal/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/brief/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CrossAssetCandleGallery.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(terminal, /CrossAssetCandleGallery/);
  assert.doesNotMatch(dashboard, /CrossAssetCandleGallery/);
  assert.doesNotMatch(brief, /CrossAssetCandleGallery/);
  assert.match(terminal, /TodayDecisionBrief/);
  assert.match(dashboard, /redirect\("\/terminal"\)/);
  assert.match(brief, /listAnalysisSnapshots\(1\)/);
  assert.match(gallery, /instrument=\{active\}/);
  assert.match(gallery, /Treasury yields remain scalar-only/);
});
