import test from "node:test";
import assert from "node:assert/strict";
import { recoverPrecisionGeometry } from "../app/api/pocket/precision-fallback.ts";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";

const cases = [
  { name: "US500 30m range", current: "7658", anchors: [{ price: 7690, y: 34 }, { price: 7670, y: 54 }, { price: 7650, y: 74 }], levels: [{ kind: "support", price: "7650", y: 74 }, { kind: "resistance", price: "7680", y: 44 }] },
  { name: "US500 4h structure", current: "7658", anchors: [{ price: 7800, y: 22 }, { price: 7650, y: 46 }, { price: 7500, y: 70 }], levels: [{ kind: "support", price: "7600", y: 54 }, { kind: "resistance", price: "7800", y: 22 }] },
  { name: "decimal equity", current: "123.45", anchors: [{ price: 126, y: 20 }, { price: 123, y: 50 }, { price: 120, y: 80 }], levels: [{ kind: "support", price: "122.50", y: 55 }, { kind: "resistance", price: "125.25", y: 27.5 }] },
] as const;

for (const sample of cases) test(`benchmark preserves both sides: ${sample.name}`, () => {
  const first = { currentPrice: sample.current, priceScaleAnchors: sample.anchors, plotBounds: { left: 5, top: 10, right: 88, bottom: 88 }, levels: [] };
  const rescue = { currentPrice: sample.current, priceScaleAnchors: [], levels: sample.levels };
  const merged = recoverPrecisionGeometry(first, rescue);
  const calibrated = calibratePocketAnalysis({ evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, scaleReadable: false, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH" }, setupScore: { overall: 65 }, ...merged }) as { levels: { kind: string; price: string }[] };
  assert.ok(calibrated.levels.some((level) => level.kind === "support" && level.price));
  assert.ok(calibrated.levels.some((level) => level.kind === "resistance" && level.price));
});
