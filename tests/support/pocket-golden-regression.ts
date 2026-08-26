import assert from "node:assert/strict";

export type GoldenGuide = {
  tool: "support" | "resistance";
  yPercent: number;
  tolerance: number;
  minimumConfidence?: "low" | "medium" | "high";
};

export type PocketGoldenCase = {
  id: string;
  imageFile: string;
  imageSha256: string;
  privacyReviewed: true;
  market: string;
  timeframe: "1m" | "5m" | "15m" | "1h" | "4h" | "daily";
  expectedLean: Array<"bullish" | "bearish" | "neutral">;
  expectedGuides: GoldenGuide[];
  forbiddenPhrases: string[];
};

type ActualGuide = {
  tool: "support" | "resistance" | "trend";
  yPercent: number;
  confidence: "low" | "medium" | "high";
};

export type GoldenActual = {
  chartReadability: "clear" | "partial" | "unreadable";
  directionalLean: "bullish" | "bearish" | "neutral";
  summary: string;
  observations: string[];
  noTradeReasons: string[];
  uncertainties: string[];
  visualGuides: ActualGuide[];
};

const confidenceRank = { low: 0, medium: 1, high: 2 } as const;

export function assertPocketGolden(caseFile: PocketGoldenCase, actual: GoldenActual): void {
  assert.notEqual(actual.chartReadability, "unreadable", `${caseFile.id}: known-readable chart was rejected`);
  assert.ok(caseFile.expectedLean.includes(actual.directionalLean), `${caseFile.id}: unexpected directional lean ${actual.directionalLean}`);

  for (const expected of caseFile.expectedGuides) {
    const candidates = actual.visualGuides.filter((guide) => guide.tool === expected.tool);
    assert.ok(candidates.length > 0, `${caseFile.id}: missing ${expected.tool}`);
    const nearest = candidates.reduce((best, guide) =>
      Math.abs(guide.yPercent - expected.yPercent) < Math.abs(best.yPercent - expected.yPercent) ? guide : best);
    assert.ok(
      Math.abs(nearest.yPercent - expected.yPercent) <= expected.tolerance,
      `${caseFile.id}: ${expected.tool} at ${nearest.yPercent}% is outside ${expected.yPercent}% ±${expected.tolerance}%`,
    );
    if (expected.minimumConfidence) {
      assert.ok(
        confidenceRank[nearest.confidence] >= confidenceRank[expected.minimumConfidence],
        `${caseFile.id}: ${expected.tool} confidence ${nearest.confidence} is below ${expected.minimumConfidence}`,
      );
    }
  }

  const customerCopy = [actual.summary, ...actual.observations, ...actual.noTradeReasons, ...actual.uncertainties].join(" ");
  for (const phrase of caseFile.forbiddenPhrases) {
    assert.doesNotMatch(customerCopy, new RegExp(phrase, "i"), `${caseFile.id}: forbidden fallback copy was returned`);
  }
}

export function validatePocketGoldenCase(value: unknown): asserts value is PocketGoldenCase {
  assert.ok(value && typeof value === "object", "golden case must be an object");
  const item = value as Partial<PocketGoldenCase>;
  assert.match(item.id ?? "", /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.match(item.imageFile ?? "", /\.(?:png|jpe?g|webp)$/i);
  assert.match(item.imageSha256 ?? "", /^[a-f0-9]{64}$/);
  assert.equal(item.privacyReviewed, true);
  assert.ok(Boolean(item.market?.trim()));
  assert.ok(["1m", "5m", "15m", "1h", "4h", "daily"].includes(item.timeframe ?? ""));
  assert.ok(Array.isArray(item.expectedLean) && item.expectedLean.length > 0);
  assert.ok(Array.isArray(item.expectedGuides) && item.expectedGuides.length > 0);
  assert.ok(item.expectedGuides.every((guide) =>
    (guide.tool === "support" || guide.tool === "resistance")
    && Number.isFinite(guide.yPercent) && guide.yPercent >= 5 && guide.yPercent <= 95
    && Number.isFinite(guide.tolerance) && guide.tolerance >= 1 && guide.tolerance <= 15));
  assert.ok(Array.isArray(item.forbiddenPhrases));
}
