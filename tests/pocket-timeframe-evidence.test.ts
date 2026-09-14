import test from "node:test";
import assert from "node:assert/strict";
import { createSampleCharts } from "../app/pocket/sample-analysis";
import { chartEvidenceLabel, chartEvidenceReport, chartEvidenceStatus, timeframeAgreement, timeframeEvidence } from "../app/pocket/timeframe-evidence";
import { bundleForChart, createChartSession, mergeChartSession } from "../app/pocket/chart-session";

test("every card uses its own report rather than the primary chart or higher-timeframe summary", () => {
  const charts = createSampleCharts();
  for (const chart of charts) {
    const evidence = timeframeEvidence(chart);
    assert.equal(evidence.structure, chart.report!.marketStructure);
    assert.equal(evidence.momentum, chart.report!.momentum);
    assert.equal(evidence.trend.toUpperCase(), chart.report!.direction);
    assert.ok(!evidence.structure.includes(chart.report!.higherTimeframe.summary));
  }
  assert.notEqual(timeframeEvidence(charts[0]).trend, timeframeEvidence(charts[2]).trend);
});

test("agreement follows the selected reference and treats neutrality as mixed, not confirmation", () => {
  const [five, thirty, hour, four, daily] = createSampleCharts();
  assert.equal(timeframeAgreement(thirty, five).label, "Trend agrees · 5m");
  assert.equal(timeframeAgreement(hour, five).label, "Trend conflicts · 5m");
  assert.equal(timeframeAgreement(five, hour).label, "Trend conflicts · 1h");
  assert.equal(timeframeAgreement(four, hour).label, "Trend agrees · 1h");
  assert.equal(timeframeAgreement(daily, five).label, "Mixed trend · 5m");
  assert.equal(timeframeAgreement(five, daily).label, "Mixed trend · 1d");
  assert.equal(timeframeAgreement(five, five).label, "Selected view");
  assert.equal(timeframeAgreement({ ...daily, id: "another" }, daily).label, "Both neutral · 1d");
});

test("different markets and contradictory tickers never acquire an agreement label", () => {
  const [main, other] = createSampleCharts();
  assert.equal(timeframeAgreement({ ...other, report: { ...other.report!, instrument: "Gold" } }, main).label, "Different market");
  assert.equal(timeframeAgreement({ ...other, report: { ...other.report!, ticker: "AAA" } }, { ...main, report: { ...main.report!, ticker: "BBB" } }).label, "Different market");
});

test("uncertain identity, timeframe, unreadable candles and a failed identity gate withhold comparison", () => {
  const [main, other] = createSampleCharts();
  for (const field of ["instrumentConfidence", "timeframeConfidence"] as const) {
    const uncertain = { ...other, report: { ...other.report!, evidenceQuality: { ...other.report!.evidenceQuality, [field]: "LOW" as const } } };
    assert.equal(timeframeAgreement(uncertain, main).label, "Identity / timeframe unverified");
    assert.equal(timeframeAgreement(main, uncertain).label, "Identity / timeframe unverified");
  }
  const unreadable = { ...other, report: { ...other.report!, evidenceQuality: { ...other.report!.evidenceQuality, candlesReadable: false } } };
  assert.equal(timeframeEvidence(unreadable).trend, "Unclear");
  assert.equal(timeframeAgreement(unreadable, main).tone, "muted");
  const unlocked = { ...other, report: { ...other.report!, trustGate: { ...other.report!.trustGate!, identityLocked: false } } };
  assert.equal(timeframeAgreement(unlocked, main).tone, "muted");
});

test("queued and failed cards do not borrow the completed primary report", () => {
  const [main, other] = createSampleCharts();
  for (const [preparation, expected] of [[undefined, "WAITING"], ["queued", "QUEUED"], ["preparing", "PREPARING…"], ["analysing", "ANALYSING…"], ["verifying", "VERIFYING…"], ["failed", "TAP TO RETRY"]] as const) {
    const pending = { ...other, report: undefined, preparation };
    assert.equal(chartEvidenceStatus(pending, null), expected);
    assert.equal(timeframeEvidence(pending).structure, "Awaiting analysis");
    assert.equal(timeframeAgreement(pending, main).label, "Awaiting analysis");
  }
  assert.equal(chartEvidenceStatus({ ...other, report: undefined }, other.id), "PREPARING…");
  assert.equal(chartEvidenceStatus({ ...other, preparation: "failed" }, other.id), "READY", "a saved report stays usable");
});

test("replaced screenshots and changed upload packs cannot show stale evidence", () => {
  const charts = createSampleCharts();
  const bundle = bundleForChart(charts, charts[1].id).images;
  const stale = { ...charts[1], image: "replacement", sourceImages: bundle };
  assert.equal(chartEvidenceReport(stale), undefined);
  assert.equal(timeframeEvidence(stale).trend, "Awaiting analysis");
  assert.equal(timeframeAgreement(stale, charts[0]).tone, "muted");
  const images = bundleForChart(charts, charts[0].id).images;
  const current = createChartSession(images, [], charts[0].report);
  current[1].report = charts[1].report;
  const merged = mergeChartSession(current, { ...images, detailImage: "replacement" }, [], charts[0].report!);
  assert.equal(timeframeEvidence(merged[1]).trend, "Awaiting analysis");
});

test("arbitrary and duplicate uploaded timeframes remain distinct without guessed slot labels", () => {
  const charts = createSampleCharts();
  assert.equal(chartEvidenceLabel({ ...charts[1], report: undefined, timeframe: "30M" }, 1), "Chart 2");
  assert.equal(chartEvidenceLabel({ ...charts[1], report: { ...charts[1].report!, timeframe: "3 min" } }, 1), "3m");
  assert.equal(chartEvidenceLabel({ ...charts[1], report: { ...charts[1].report!, timeframe: "monthly" } }, 1), "1mo");
  const duplicate = { ...charts[1], report: { ...charts[1].report!, timeframe: "5M" } };
  assert.equal(chartEvidenceLabel(charts[0], 0), chartEvidenceLabel(duplicate, 1));
  assert.notEqual(charts[0].id, duplicate.id);
});

test("missing evidence and qualified wording remain honest", () => {
  const chart = createSampleCharts()[0];
  const momentum = "Bullish impulse, but fading. No RSI panel is visible; a reversal is unconfirmed.";
  const evidence = timeframeEvidence({ ...chart, report: { ...chart.report!, momentum, marketStructure: "" } });
  assert.equal(evidence.momentum, momentum);
  assert.equal(evidence.structure, "Not established");
  assert.equal(timeframeAgreement(chart, undefined).label, "Awaiting analysis");
});
