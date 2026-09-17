import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import BullseyeDecisionEngine from "../../app/pocket/BullseyeDecisionEngine";
import LiquidityGuardOverlay from "../../app/pocket/LiquidityGuardOverlay";
import { createSampleCharts } from "../../app/pocket/sample-analysis";
import { evidencePrice, evidencePriceRange } from "../../app/pocket/evidence-price";

const sample = createSampleCharts()[0].report!;

test("bearish confirmation is not presented as strengthening a bullish case", () => {
  const html = renderToStaticMarkup(<BullseyeDecisionEngine analysis={{ ...sample, direction: "BEARISH", liquidityShield: undefined, nextSequence: { ...sample.nextSequence, confirmation: "Price closes below support at 100." } }} charts={[]} performance={null}/>);
  assert.match(html, /Bearish interpretation/);
  assert.match(html, /data-tone="bear"><small>STRENGTHENS THIS READ<\/small><strong>Price closes below support at 100/);
  assert.doesNotMatch(html, /STRENGTHENS THE BULL CASE|TRAP RADAR|EVIDENCE BALANCE/);
  assert.match(html, /not a measured win rate or probability/);
});

test("neutral evidence does not imply that a direction has been established", () => {
  const html = renderToStaticMarkup(<BullseyeDecisionEngine analysis={{ ...sample, direction: "NEUTRAL" }} charts={[]} performance={null}/>);
  assert.match(html, /No directional read established/);
  assert.match(html, /CONFIRMATION TO LOOK FOR/);
  assert.doesNotMatch(html, /Bullish interpretation|Bearish interpretation|STRENGTHENS THIS READ/);
});

test("price labels retain narrow forex and tiny asset ranges without collapsing endpoints", () => {
  assert.equal(evidencePriceRange(1.23451, 1.23459), "1.23451–1.23459");
  assert.equal(evidencePriceRange(0.00000001, 0.00000002), "0.00000001–0.00000002");
  assert.equal(evidencePriceRange(7650, 7650), "7,650");
  for (const value of [1.234567891234, 0.00000000123, 98765.4321987]) {
    assert.equal(Number(evidencePrice(value).replaceAll(",", "")), value);
  }
  assert.equal(evidencePrice(Number.NaN), "Unverified");
});

test("verified forex stop-risk overlay renders the original endpoints", () => {
  const html = renderToStaticMarkup(<LiquidityGuardOverlay sourceImage="data:image/png;base64,AA==" analysis={{
    timeframe: "15m", currentPrice: "1.2347",
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true },
    plotBounds: { left: 8, top: 12, right: 88, bottom: 86 },
    priceScaleAnchors: [{ price: 1.2350, y: 20 }, { price: 1.2347, y: 50 }, { price: 1.2344, y: 80 }],
    liquidityShield: { status: "VISIBLE_RISK_ZONES", summary: "Three repeated lows.", stopGuidance: "Verify the original chart.", zones: [{
      side: "BELOW_PRICE", pattern: "EQUAL_LOWS", label: "Repeated lows", priceLow: 1.23451, priceHigh: 1.23459, confidence: "HIGH", evidence: "The wicks align with the scale.", touchPoints: [{ x: 25, y: 65 }, { x: 48, y: 65.2 }, { x: 70, y: 64.8 }],
    }] },
  }}/>);
  assert.match(html, /data-status="locked"/);
  assert.match(html, /1\.23451–1\.23459/);
  assert.doesNotMatch(html, /1\.235–1\.235/);
});
