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
  scenario: "range" | "trend" | "breakout" | "reversal" | "unclear";
  expectedReadability: Array<"clear" | "partial" | "unreadable">;
  maximumExtraGuides: number;
  privacyReview: {
    reviewedAt: string;
    reviewer: string;
    consent: "owner-supplied" | "licensed-test-chart";
    redactions: string[];
  };
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

export type PocketBenchmarkMetrics = {
  charts: number;
  requiredGuides: number;
  matchedGuides: number;
  guideRecallPercent: number;
  chartsPassing: number;
  chartPassPercent: number;
  extraGuides: number;
  scenarios: string[];
  timeframes: string[];
};

export function scorePocketGolden(caseFile: PocketGoldenCase, actual: GoldenActual) {
  let matchedGuides = 0;
  for (const expected of caseFile.expectedGuides) {
    const candidates = actual.visualGuides.filter((guide) => guide.tool === expected.tool);
    const nearest = candidates.sort((a, b) => Math.abs(a.yPercent - expected.yPercent) - Math.abs(b.yPercent - expected.yPercent))[0];
    if (nearest && Math.abs(nearest.yPercent - expected.yPercent) <= expected.tolerance
      && (!expected.minimumConfidence || confidenceRank[nearest.confidence] >= confidenceRank[expected.minimumConfidence])) matchedGuides += 1;
  }
  const extraGuides = Math.max(0, actual.visualGuides.filter((guide) => guide.tool !== "trend").length - caseFile.expectedGuides.length);
  const copy = [actual.summary, ...actual.observations, ...actual.noTradeReasons, ...actual.uncertainties].join(" ");
  const passed = caseFile.expectedReadability.includes(actual.chartReadability)
    && caseFile.expectedLean.includes(actual.directionalLean)
    && matchedGuides === caseFile.expectedGuides.length
    && extraGuides <= caseFile.maximumExtraGuides
    && caseFile.forbiddenPhrases.every((phrase) => !new RegExp(phrase, "i").test(copy));
  return { matchedGuides, requiredGuides: caseFile.expectedGuides.length, extraGuides, passed };
}

export function summarizePocketBenchmark(results: Array<{ golden: PocketGoldenCase; actual: GoldenActual }>): PocketBenchmarkMetrics {
  const scored = results.map(({ golden, actual }) => ({ golden, ...scorePocketGolden(golden, actual) }));
  const requiredGuides = scored.reduce((sum, item) => sum + item.requiredGuides, 0);
  const matchedGuides = scored.reduce((sum, item) => sum + item.matchedGuides, 0);
  return {
    charts: scored.length,
    requiredGuides,
    matchedGuides,
    guideRecallPercent: requiredGuides ? Math.round(matchedGuides / requiredGuides * 100) : 0,
    chartsPassing: scored.filter((item) => item.passed).length,
    chartPassPercent: scored.length ? Math.round(scored.filter((item) => item.passed).length / scored.length * 100) : 0,
    extraGuides: scored.reduce((sum, item) => sum + item.extraGuides, 0),
    scenarios: [...new Set(scored.map((item) => item.golden.scenario))].sort(),
    timeframes: [...new Set(scored.map((item) => item.golden.timeframe))].sort(),
  };
}

export function assertPocketReleaseGate(metrics: PocketBenchmarkMetrics, minimumCharts = 30): void {
  assert.ok(metrics.charts >= minimumCharts, `benchmark has ${metrics.charts}/${minimumCharts} required privacy-approved charts`);
  assert.ok(metrics.scenarios.length >= 4, `benchmark covers only ${metrics.scenarios.length}/4 required scenario families`);
  assert.ok(metrics.timeframes.length >= 3, `benchmark covers only ${metrics.timeframes.length}/3 required timeframes`);
  assert.ok(metrics.guideRecallPercent >= 90, `guide recall ${metrics.guideRecallPercent}% is below 90%`);
  assert.ok(metrics.chartPassPercent >= 85, `chart pass rate ${metrics.chartPassPercent}% is below 85%`);
  assert.ok(metrics.extraGuides <= Math.ceil(metrics.charts * 0.1), `extra guide count ${metrics.extraGuides} exceeds the false-positive allowance`);
}

export function assertPocketGolden(caseFile: PocketGoldenCase, actual: GoldenActual): void {
  assert.ok(caseFile.expectedReadability.includes(actual.chartReadability), `${caseFile.id}: unexpected readability ${actual.chartReadability}`);
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

  const extraGuides = Math.max(0, actual.visualGuides.filter((guide) => guide.tool !== "trend").length - caseFile.expectedGuides.length);
  assert.ok(extraGuides <= caseFile.maximumExtraGuides, `${caseFile.id}: returned ${extraGuides} unsupported extra guides`);

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
  assert.ok(["range", "trend", "breakout", "reversal", "unclear"].includes(item.scenario ?? ""));
  assert.ok(Array.isArray(item.expectedReadability) && item.expectedReadability.length > 0);
  assert.ok(item.expectedReadability.every((value) => ["clear", "partial", "unreadable"].includes(value)));
  assert.ok(Number.isInteger(item.maximumExtraGuides) && Number(item.maximumExtraGuides) >= 0 && Number(item.maximumExtraGuides) <= 2);
  assert.ok(item.privacyReview && typeof item.privacyReview === "object");
  assert.match(item.privacyReview?.reviewedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Boolean(item.privacyReview?.reviewer?.trim()));
  assert.ok(["owner-supplied", "licensed-test-chart"].includes(item.privacyReview?.consent ?? ""));
  assert.ok(Array.isArray(item.privacyReview?.redactions));
}
