import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import LiquidityGuardOverlay from "../../app/pocket/LiquidityGuardOverlay";

const base = {
  timeframe: "15m",
  currentPrice: "2,900",
  evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true },
  plotBounds: { left: 8, top: 12, right: 88, bottom: 86 },
  priceScaleAnchors: [{ price: 3000, y: 20 }, { price: 2900, y: 50 }, { price: 2800, y: 80 }],
};

test("verified Liquidity Guard renders source chart, risk band, touch evidence and textual side", () => {
  const html = renderToStaticMarkup(<LiquidityGuardOverlay sourceImage="data:image/png;base64,AA==" analysis={{
    ...base,
    liquidityShield: {
      status: "VISIBLE_RISK_ZONES",
      summary: "Scale and candle rows agree.",
      stopGuidance: "Keep invalidation beyond the visible structure.",
      zones: [{
        side: "BELOW_PRICE",
        pattern: "EQUAL_LOWS",
        label: "Equal lows",
        priceLow: 2850,
        priceHigh: 2850,
        confidence: "HIGH",
        evidence: "Three aligned wick lows.",
        touchPoints: [{ x: 25, y: 65 }, { x: 48, y: 65.2 }, { x: 70, y: 64.8 }],
      }],
    },
  }}/>)
  assert.match(html, /VISUAL STOP-RISK MAP/);
  assert.match(html, /data-touch="true"/);
  assert.match(html, /BELOW CURRENT/);
  assert.match(html, /SCALE-CHECKED AREA/);
  assert.doesNotMatch(html, /OVERLAY WITHHELD/);
});

test("poor evidence leaves the source chart unobstructed and explains the withheld overlay once", () => {
  const html = renderToStaticMarkup(<LiquidityGuardOverlay sourceImage="data:image/png;base64,AA==" analysis={{
    ...base,
    evidenceQuality: { chartReadability: "POOR", candlesReadable: false },
    liquidityShield: {
      status: "VISIBLE_RISK_ZONES",
      summary: "Untrusted model claim.",
      stopGuidance: "Untrusted guidance.",
      zones: [{
        side: "BELOW_PRICE",
        pattern: "EQUAL_LOWS",
        label: "Equal lows",
        priceLow: 2850,
        priceHigh: 2850,
        confidence: "HIGH",
        evidence: "Untrusted evidence.",
        touchPoints: [{ x: 25, y: 65 }, { x: 70, y: 65 }],
      }],
    },
  }}/>)
  assert.match(html, /data-status="withheld"/);
  assert.match(html, /OVERLAY WITHHELD/);
  assert.match(html, /Bullseye could not verify a stop-risk zone precisely enough/);
  assert.equal(html.match(/Bullseye could not verify a stop-risk zone precisely enough/g)?.length, 1);
  assert.doesNotMatch(html, /psLiquidityVector/);
  assert.doesNotMatch(html, /psLiquidityHold/);
  assert.doesNotMatch(html, /HIDE OVERLAY/);
  assert.doesNotMatch(html, /No candidate survived scale, side, candle-row and readability verification/);
  assert.doesNotMatch(html, /Untrusted guidance/);
  assert.ok(html.indexOf("psLiquidityStatus") < html.indexOf("psLiquidityCanvas"), "the withheld explanation must appear before the unmarked chart");
});

test("a completed scan with no visible cluster is distinct from withheld evidence", () => {
  const html = renderToStaticMarkup(<LiquidityGuardOverlay sourceImage="data:image/png;base64,AA==" analysis={{
    ...base,
    liquidityShield: {
      status: "NO_VISIBLE_RISK_ZONES",
      summary: "No cluster was visible.",
      stopGuidance: "Use the setup invalidation.",
      zones: [],
    },
  }}/>)
  assert.match(html, /data-status="verified-none"/);
  assert.match(html, /NO CLEAR STOP-RISK CLUSTER/);
  assert.match(html, /Nothing has been added to your chart/);
  assert.doesNotMatch(html, /OVERLAY WITHHELD/);
  assert.doesNotMatch(html, /psLiquidityVector/);
});

test("a missing Liquidity Guard result reports unavailable without covering the chart", () => {
  const html = renderToStaticMarkup(<LiquidityGuardOverlay sourceImage="data:image/png;base64,AA==" analysis={base}/>)
  assert.match(html, /data-status="unavailable"/);
  assert.match(html, /LIQUIDITY GUARD UNAVAILABLE/);
  assert.match(html, /Your chart remains unchanged/);
  assert.doesNotMatch(html, /psLiquidityHold/);
  assert.doesNotMatch(html, /psLiquidityVector/);
});
