import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { calibratePocketAnalysis, enforcePocketTrustGate } from "../app/api/pocket/analysis-calibration.ts";
import { normalizeLockedDecision, normalizeLockedDecisions } from "../app/pocket/decision-compatibility.ts";
import { resetPocketBudgetsForTesting, takePocketBudget } from "../app/lib/server/pocket-request-budget.ts";
import { calculateRiskDesk } from "../app/pocket/pocket-risk-desk.ts";

test("legacy saved decisions are migrated without changing chart bytes", () => {
  const image = "data:image/png;base64,UNCHANGED";
  const migrated = normalizeLockedDecision({ createdAt: "2026-08-01T10:00:00Z", image, analysis: { instrument: "ES", setupScore: { overall: 72 } } });
  assert.ok(migrated);
  assert.equal(migrated.image, image);
  assert.equal(migrated.intention, "UNSURE");
  assert.equal(migrated.analysis.setupScore.grade, "B");
  assert.deepEqual(migrated.analysis.riskFlags, []);
  assert.equal(migrated.analysis.verdict, "REVIEW_REQUIRED");
});

test("invalid local records are skipped instead of breaking the vault", () => {
  const valid = { id: "1", createdAt: "2026-08-01T10:00:00Z", image: "data:image/jpeg;base64,AA", intention: "LONG", analysis: {} };
  assert.equal(normalizeLockedDecisions([null, {}, valid]).length, 1);
});

test("poor evidence always fails closed and cannot retain an inflated grade", () => {
  const result = calibratePocketAnalysis({
    confidence: "HIGH",
    verdict: "WATCH",
    ticker: "AAPL",
    timeframe: "5m",
    evidenceQuality: { chartReadability: "POOR", candlesReadable: false, scaleReadable: false, instrumentConfidence: "LOW", timeframeConfidence: "UNKNOWN" },
    setupScore: { overall: 96, grade: "A" },
    levels: [{ kind: "support", price: "123.45", y: 50 }],
    fibLevels: [{ ratio: "0.5", price: "123", y: 50 }],
  }) as {
    verdict: string;
    confidence: string;
    ticker: string;
    timeframe: string;
    setupScore: { overall: number; grade: string };
    levels: Array<{ price: string }>;
    fibLevels: unknown[];
  };
  assert.equal(result.verdict, "REVIEW_REQUIRED");
  assert.equal(result.confidence, "LOW");
  assert.equal(result.setupScore.overall, 54);
  assert.equal(result.setupScore.grade, "D");
  assert.equal(result.ticker, "UNKNOWN");
  assert.equal(result.timeframe, "UNKNOWN");
  assert.equal(result.levels[0].price, "");
  assert.deepEqual(result.fibLevels, []);
});

test("score and grade are made internally consistent for readable charts", () => {
  const result = calibratePocketAnalysis({ evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, scaleReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH" }, setupScore: { overall: 84.7, grade: "A" } }) as { setupScore: { overall: number; grade: string } };
  assert.equal(result.setupScore.overall, 85);
  assert.equal(result.setupScore.grade, "A");
});

test("a confident narrative is forced to wait when exact price structure is not verified", () => {
  const result = calibratePocketAnalysis({
    confidence: "HIGH",
    verdict: "WATCH",
    contradictions: [],
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, scaleReadable: false, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH" },
    setupScore: { overall: 88, grade: "A" },
    plotBounds: { left: 10, top: 10, right: 90, bottom: 90 },
    priceScaleAnchors: [],
    levels: [{ kind: "support", label: "Visible shelf", price: "7600", y: 70 }],
    fibLevels: [],
  }) as { confidence: string; verdict: string; setupScore: { overall: number; grade: string }; trustGate: { status: string; scaleLocked: boolean } };
  assert.equal(result.trustGate.status, "PARTIAL");
  assert.equal(result.trustGate.scaleLocked, false);
  assert.equal(result.confidence, "MEDIUM");
  assert.equal(result.verdict, "WAIT");
  assert.deepEqual(result.setupScore, { overall: 69, grade: "C" });
});

test("a single exact side can never lock the two-sided trust gate", () => {
  const result = calibratePocketAnalysis({
    confidence: "HIGH",
    verdict: "WATCH",
    contradictions: [],
    currentPrice: "7660",
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, scaleReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH" },
    setupScore: { overall: 82, grade: "B" },
    plotBounds: { left: 8, top: 12, right: 88, bottom: 86 },
    priceScaleAnchors: [{ price: 7700, y: 25 }, { price: 7600, y: 75 }],
    levels: [{ kind: "support", label: "Visible shelf", price: "7640", y: 55 }],
    fibLevels: [],
  }) as { trustGate: { status: string; exactLevelCount: number }; verdict: string; confidence: string; setupScore: { overall: number; grade: string } };
  assert.equal(result.trustGate.status, "PARTIAL");
  assert.equal(result.trustGate.exactLevelCount, 1);
  assert.equal(result.verdict, "WAIT");
  assert.equal(result.confidence, "MEDIUM");
  assert.deepEqual(result.setupScore, { overall: 69, grade: "C" });
});

test("the final combined gate reapplies strict ceilings and preserves locked results", () => {
  const report = { confidence: "HIGH", verdict: "WATCH", setupScore: { overall: 96, grade: "A" } };
  const partial = enforcePocketTrustGate(report, { status: "PARTIAL" }) as typeof report;
  assert.deepEqual(partial, { confidence: "MEDIUM", verdict: "WAIT", setupScore: { overall: 69, grade: "C" }, trustGate: { status: "PARTIAL" } });
  const held = enforcePocketTrustGate(report, { status: "HOLD" }) as typeof report;
  assert.deepEqual(held, { confidence: "LOW", verdict: "REVIEW_REQUIRED", setupScore: { overall: 54, grade: "D" }, trustGate: { status: "HOLD" } });
  const locked = enforcePocketTrustGate(report, { status: "LOCKED" }) as typeof report;
  assert.deepEqual(locked, { ...report, trustGate: { status: "LOCKED" } });
});

test("a verified two-sided map preserves a locked report", () => {
  const result = calibratePocketAnalysis({
    confidence: "HIGH",
    verdict: "WATCH",
    contradictions: [],
    currentPrice: "7660",
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, scaleReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH" },
    setupScore: { overall: 82, grade: "B" },
    plotBounds: { left: 8, top: 12, right: 88, bottom: 86 },
    priceScaleAnchors: [{ price: 7700, y: 25 }, { price: 7600, y: 75 }],
    levels: [
      { kind: "support", label: "Visible floor", price: "7640", y: 55 },
      { kind: "resistance", label: "Visible ceiling", price: "7680", y: 35 },
    ],
    fibLevels: [],
  }) as { trustGate: { status: string }; verdict: string; confidence: string; setupScore: { overall: number; grade: string } };
  assert.equal(result.trustGate.status, "LOCKED");
  assert.equal(result.verdict, "WATCH");
  assert.equal(result.confidence, "HIGH");
  assert.deepEqual(result.setupScore, { overall: 82, grade: "B" });
});

test("scale anchors outside the candle plot can never lock exact structure", () => {
  const result = calibratePocketAnalysis({
    confidence: "HIGH",
    verdict: "WATCH",
    contradictions: [],
    currentPrice: "100",
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, scaleReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH" },
    setupScore: { overall: 90, grade: "A" },
    plotBounds: { left: 8, top: 30, right: 88, bottom: 70 },
    priceScaleAnchors: [{ price: 110, y: 10 }, { price: 90, y: 90 }],
    levels: [
      { kind: "support", label: "floor", price: "95", y: 70 },
      { kind: "resistance", label: "ceiling", price: "105", y: 30 },
    ],
    fibLevels: [],
  }) as { trustGate: { status: string; scaleLocked: boolean }; verdict: string };
  assert.equal(result.trustGate.scaleLocked, false);
  assert.notEqual(result.trustGate.status, "LOCKED");
  assert.notEqual(result.verdict, "WATCH");
});

test("one-more-view prompts exclude trader plan fields", () => {
  const calibrated = calibratePocketAnalysis({
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true },
    setupScore: { overall: 70, grade: "B" },
    missingInputs: ["Exact entry, stop and target", "A visible volume panel", "Account size"],
  }) as { missingInputs: string[] };
  assert.deepEqual(calibrated.missingInputs, ["A visible volume panel"]);
});

test("readable price anchors calibrate horizontal levels into the candle plot", () => {
  const calibrated = calibratePocketAnalysis({
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true },
    setupScore: { overall: 70, grade: "B" },
    missingInputs: [],
    plotBounds: { left: 20, top: 15, right: 82, bottom: 80 },
    priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7700, y: 45 }, { price: 7600, y: 70 }],
    levels: [{ kind: "support", label: "Support", price: "7700", x: 0, y: 45, x2: 1, y2: 45 }],
  }) as { levels: Array<{ x: number; y: number; x2: number; y2: number }> };
  assert.deepEqual(calibrated.levels[0], { kind: "support", label: "Support", price: "7700", x: 20, y: 45, x2: 82, y2: 45 });
});

test("readable candles preserve visual support and resistance when exact scale prices cannot be verified", () => {
  const calibrated = calibratePocketAnalysis({
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: false },
    setupScore: { overall: 64, grade: "C" },
    plotBounds: { left: 10, top: 12, right: 88, bottom: 86 },
    priceScaleAnchors: [],
    levels: [
      { kind: "resistance", label: "Repeated rejection", price: "7800", y: 28 },
      { kind: "support", label: "Repeated defence", price: "7600", y: 72 },
    ],
  }) as { levels: Array<{ kind: string; price: string; x: number; x2: number; y: number }> };
  assert.deepEqual(calibrated.levels.map(({ kind, price, x, x2, y }) => ({ kind, price, x, x2, y })), [
    { kind: "resistance", price: "", x: 10, x2: 88, y: 28 },
    { kind: "support", price: "", x: 10, x2: 88, y: 72 },
  ]);
});

test("dedicated scale anchors override a conservative prose-pass scale flag", () => {
  const calibrated = calibratePocketAnalysis({
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: false },
    setupScore: { overall: 70, grade: "B" },
    plotBounds: { left: 8, top: 12, right: 88, bottom: 86 },
    priceScaleAnchors: [{ price: 7750, y: 30 }, { price: 7700, y: 45 }, { price: 7650, y: 60 }],
    levels: [{ kind: "support", label: "Defended low", price: "7600", y: 75 }],
  }) as { evidenceQuality: { scaleReadable: boolean }; levels: Array<{ price: string; y: number }> };
  assert.equal(calibrated.evidenceQuality.scaleReadable, true);
  assert.deepEqual(calibrated.levels.map((level) => [level.price, level.y]), [["7600", 75]]);
});

test("verified linear scale accepts extrapolated levels that remain inside the plot", () => {
  const calibrated = calibratePocketAnalysis({
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true },
    setupScore: { overall: 70, grade: "B" },
    plotBounds: { left: 8, top: 12, right: 88, bottom: 86 },
    priceScaleAnchors: [{ price: 7750, y: 30 }, { price: 7700, y: 45 }, { price: 7650, y: 60 }],
    levels: [{ kind: "support", label: "Lower shelf", price: "7600", y: 75 }],
  }) as { levels: Array<{ price: string; y: number }> };
  assert.deepEqual(calibrated.levels.map((level) => [level.price, level.y]), [["7600", 75]]);
});

test("mislabelled horizontal levels are classified by current market location", () => {
  const calibrated = calibratePocketAnalysis({
    currentPrice: "7661.05",
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true },
    setupScore: { overall: 70, grade: "B" },
    plotBounds: { left: 20, top: 15, right: 82, bottom: 80 },
    priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7700, y: 45 }, { price: 7600, y: 70 }],
    levels: [
      { kind: "support", label: "upper shelf", price: "7700", y: 45 },
      { kind: "resistance", label: "lower shelf", price: "7600", y: 70 },
    ],
  }) as { levels: Array<{ kind: string; price: string }> };
  assert.deepEqual(calibrated.levels.map((level) => [level.kind, level.price]), [
    ["resistance", "7700"],
    ["support", "7600"],
  ]);
});

test("a rounded near-current level is a pivot and cannot certify either structural side", () => {
  const calibrated = calibratePocketAnalysis({
    currentPrice: "7639.92",
    contradictions: [],
    confidence: "HIGH",
    verdict: "WATCH",
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true },
    setupScore: { overall: 80, grade: "B" },
    plotBounds: { left: 8, top: 12, right: 88, bottom: 86 },
    priceScaleAnchors: [{ price: 7680, y: 20 }, { price: 7640, y: 50 }, { price: 7600, y: 80 }],
    levels: [
      { kind: "support", label: "rounded current row", price: "7640", y: 50 },
      { kind: "resistance", label: "ceiling", price: "7680", y: 20 },
    ],
  }) as { levels: Array<{ kind: string; price: string }>; trustGate: { status: string; exactLevelCount: number } };
  assert.deepEqual(calibrated.levels.map((level) => [level.kind, level.price]), [["pivot", "7640"], ["resistance", "7680"]]);
  assert.equal(calibrated.trustGate.status, "PARTIAL");
  assert.equal(calibrated.trustGate.exactLevelCount, 1);
});

test("unverified levels retain visual geometry while out-of-scale verified claims fail closed", () => {
  const base = {
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true },
    setupScore: { overall: 70, grade: "B" },
    plotBounds: { left: 20, top: 15, right: 82, bottom: 80 },
  };
  const noAnchors = calibratePocketAnalysis({ ...base, priceScaleAnchors: [], levels: [{ kind: "support", price: "7700", y: 45 }] }) as { levels: unknown[] };
  const outsideScale = calibratePocketAnalysis({ ...base, priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7600, y: 70 }], levels: [{ kind: "resistance", price: "8100", y: 12 }] }) as { levels: unknown[] };
  assert.deepEqual(noAnchors.levels, [{ kind: "support", price: "", y: 45, x: 20, x2: 82, y2: 45 }]);
  assert.deepEqual(outsideScale.levels, []);
});

test("a price whose claimed pixel row disagrees with the scale is withheld", () => {
  const calibrated = calibratePocketAnalysis({
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true },
    setupScore: { overall: 70, grade: "B" },
    plotBounds: { left: 20, top: 15, right: 82, bottom: 80 },
    priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7700, y: 45 }, { price: 7600, y: 70 }],
    levels: [{ kind: "support", label: "wrong row", price: "7700", y: 67 }],
  }) as { levels: unknown[] };
  assert.deepEqual(calibrated.levels, []);
});

test("two wide scale anchors restore a geometrically matching level", () => {
  const calibrated = calibratePocketAnalysis({
    currentPrice: "7660",
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true },
    setupScore: { overall: 70, grade: "B" },
    plotBounds: { left: 8, top: 12, right: 88, bottom: 86 },
    priceScaleAnchors: [{ price: 7700, y: 25 }, { price: 7600, y: 75 }],
    levels: [{ kind: "support", label: "visible shelf", price: "7640", y: 55 }],
  }) as { levels: Array<{ price: string; y: number }> };
  assert.deepEqual(calibrated.levels.map((level) => [level.price, level.y]), [["7640", 55]]);
});

test("a small mobile reading-crop offset keeps a scale-verified level", () => {
  const calibrated = calibratePocketAnalysis({
    currentPrice: "7660",
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true },
    setupScore: { overall: 70, grade: "B" },
    plotBounds: { left: 8, top: 12, right: 88, bottom: 86 },
    priceScaleAnchors: [{ price: 7700, y: 25 }, { price: 7600, y: 75 }],
    levels: [{ kind: "support", label: "visible shelf", price: "7640", y: 59 }],
  }) as { levels: Array<{ price: string; y: number }> };
  assert.deepEqual(calibrated.levels.map((level) => [level.price, level.y]), [["7640", 55]]);
});

test("the personal risk desk calculates from explicit customer inputs only", () => {
  const result = calculateRiskDesk({ accountValue: "10,000", riskPercent: "0.5", stopDistance: "12.5", valuePerPoint: "2" });
  assert.equal(result.cashRisk, 50);
  assert.equal(result.riskPerUnit, 25);
  assert.equal(result.units, 2);
  const incomplete = calculateRiskDesk({ accountValue: "10,000", riskPercent: "0.5", stopDistance: "", valuePerPoint: "" });
  assert.equal(incomplete.cashRisk, 50);
  assert.equal(incomplete.units, null);
});

test("the complete Pocket journey retains privacy, failure and duplicate-request safeguards", async () => {
  const [client, styles, commandStyles, feedbackStyles, cinemaStyles, analyseRoute, reviewRoute, followUpRoute, eventsRoute] = await Promise.all([
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-launch-v16.css", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-2.css", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-feedback.css", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-cinema-pro.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pocket/review/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pocket/follow-up/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pocket/events/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /analysisRequestActive\.current/);
  assert.match(client, /followUpRequestActive\.current/);
  assert.match(client, /PRIVACY SHIELD/);
  assert.match(client, /NO ORDER CONNECTION/);
  assert.match(client, /normalizeLockedDecisions/);
  assert.match(client, /POCKET_ANALYSIS_ENGINE_VERSION = 11/);
  assert.match(client, /POCKET_ANALYSIS_CACHE_TTL_MS = 15 \* 60 \* 1000/);
  assert.match(client, /ageMs >= 0 && ageMs < POCKET_ANALYSIS_CACHE_TTL_MS/);
  assert.match(client, /hasVerifiedTwoSidedAnalysis\(cached, Boolean\(selectedContext\)\)/);
  assert.match(client, /hasVerifiedTwoSidedAnalysis\(payload\.analysis, Boolean\(selectedContext\)\)/);
  assert.match(client, /hasVerifiedTwoSidedStructure/);
  assert.match(client, /createPrecisionReadingCrop/);
  assert.match(client, /precisionImage, contextPrecisionImage/);
  assert.match(client, /pocket-analysis-v\$\{POCKET_ANALYSIS_ENGINE_VERSION\}/);
  assert.match(client, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(client, /analysisCacheGet\(cacheKey\)/);
  assert.match(client, /analysisCacheSave\(cacheKey, payload\.analysis\)/);
  assert.match(client, /addResultContextFile/);
  assert.match(client, /Add another timeframe chart photo/);
  assert.match(client, /requestPocketAnalysis\(contextImage, \{ bypassCache: true \}\)/);
  assert.match(client, /Support, resistance and the written read are being checked again/);
  assert.match(client, /TWO CHARTS ANALYSED/);
  assert.match(client, /TWO CHARTS LOADED · OPTIONAL FINAL CHECK/);
  assert.match(client, /NO VERIFIED SCORE/);
  assert.match(client, /SWING REFERENCE/);
  assert.match(client, /psRefineDelta/);
  assert.match(analyseRoute, /contextContribution/);
  assert.match(analyseRoute, /instrumentIdentifier/);
  assert.match(analyseRoute, /const userVerifiedInstrument = accuracyCorrection\?\.instrument \?\? chartConfirmation\?\.instrument/);
  assert.match(analyseRoute, /const exactPrimaryInstrument = userVerifiedInstrument/);
  assert.match(analyseRoute, /verifiedPrecisionInstrumentIdentifier\(primaryPrecisionInstrumentIdentifier, primaryPrecisionInstrumentConfidence\)/);
  assert.match(analyseRoute, /enforcePocketTrustGate\(calibrated, finalGate\)/);
  assert.match(analyseRoute, /max_output_tokens: 7000/);
  assert.match(analyseRoute, /analysis report was interrupted before it finished/);
  assert.match(analyseRoute, /Never request entry, stop, target/);
  assert.doesNotMatch(client, /setAnalysis\(null\)[\s\S]{0,120}Supporting chart added/);
  assert.match(client, /DecisionMap/);
  assert.match(client, /Bullseye Decision Map/);
  assert.doesNotMatch(client, /LevelVerificationPanel/);
  assert.match(client, /SOURCE CHART/);
  assert.match(styles, /\.psBattlefield\{/);
  assert.match(analyseRoute, /priceScaleAnchors/);
  assert.match(analyseRoute, /pocket_bullseye_precision_overlays/);
  assert.match(analyseRoute, /contextPrecisionResult/);
  assert.match(analyseRoute, /contextBattlefield/);
  assert.match(analyseRoute, /Promise\.all/);
  assert.match(analyseRoute, /Fail closed/);
  assert.match(client, /numericLevel/);
  assert.match(client, /psBattleCurrent/);
  assert.match(client, /psSourceEvidence/);
  assert.match(client, /MARKET LOCATION/);
  assert.match(client, /RECLAIM ROUTE/);
  assert.match(client, /BREAK ROUTE/);
  assert.match(client, /WHY WAIT\?/);
  assert.match(client, /IF \/ THEN DECISION PATHS/);
  assert.doesNotMatch(client, /SHOW ON DECISION MAP/);
  assert.match(client, /battlefieldChart/);
  assert.match(client, /Choose chart for Bullseye Decision Map/);
  assert.match(client, /contextBattlefield/);
  assert.match(client, /Calibrated Decision Map price ladder/);
  assert.doesNotMatch(client, /FULL EVIDENCE AUDIT/);
  assert.doesNotMatch(client, /DETAILED MARKET AUDIT/);
  assert.match(client, /ACTIVE DECISION RANGE/);
  assert.match(client, /showResultReveal/);
  assert.match(client, /START MY CINEMATIC RESULT/);
  assert.match(client, /ClarityLock/);
  assert.match(client, /BULLSEYE CLARITY LOCK/);
  assert.match(client, /BullseyePlan/);
  assert.match(client, /YOUR BULLSEYE PLAN/);
  assert.match(client, /VIEW RESULT CARD/);
  assert.match(client, /showResultCard/);
  assert.match(client, /pocket-bullseye-result\.png/);
  assert.match(client, /ScenarioTheatre/);
  assert.match(client, /NO FORECAST CANDLES/);
  assert.doesNotMatch(client, /NEXT-CANDLE LAB/);
  assert.match(client, /ABOVE SUPPORT · BELOW RESISTANCE/);
  assert.match(client, /<ScenarioTheatre analysis=/);
  assert.match(client, /ChartXRay/);
  assert.match(client, /BULLSEYE PATTERN X-RAY/);
  for (const tool of ["PATTERNS", "S / R", "SWINGS", "FIBONACCI", "RSI"]) assert.match(client, new RegExp(tool.replace("/", "\\/")));
  assert.match(client, /item\.reason\.replaceAll/);
  assert.match(client, /<ChartXRay analysis=/);
  assert.match(client, /MarketStory/);
  assert.match(client, /BULLSEYE MARKET STORY/);
  assert.match(client, /CHAPTER 04 · BULL VS BEAR/);
  assert.match(client, /FINAL CHAPTER ·/);
  assert.match(client, /BULLSEYE"/);
  assert.match(client, /STORY, NOT CERTAINTY/);
  assert.match(client, /pocket-bullseye-viewer-name/);
  assert.match(client, /MAKE BULLSEYE YOURS/);
  assert.match(client, /viewerName\.trim\(\)/);
  assert.match(client, /<BullseyePlan analysis=/);
  assert.match(client, /PocketCommandDeck/);
  assert.match(client, /POCKET BULLSEYE 2\.0/);
  assert.match(client, /PERSONAL RISK DESK/);
  assert.match(client, /pocket-risk-desk-v1/);
  assert.match(client, /EVENT RISK CONTEXT/);
  assert.match(client, /psResultSupportInput/);
  assert.doesNotMatch(client, /could not be verified safely/);
  assert.doesNotMatch(client, /ADD ANOTHER PHOTO/);
  assert.match(client, /ADD ONE CLEARER PRICE-SCALE CHART/);
  assert.match(client, /NO VERIFIED TWO-SIDED LEVELS/);
  assert.match(client, /Bullseye checked both charts but could not verify support below and resistance above the current price\. The map is withheld rather than guessed\./);
  assert.match(client, /VIEW BOTH SOURCE CHARTS/);
  assert.match(client, /OPEN LEVEL LAB/);
  assert.match(client, /reanalyseResult/);
  assert.match(client, /↻ REANALYSE/);
  assert.match(client, /REANALYSE ALL CHARTS/);
  assert.match(client, /bypassCache: true/);
  assert.match(client, /SECOND VIEW ATTACHED/);
  assert.match(client, /FINDINGS UPDATED/);
  assert.doesNotMatch(client, /SUPPORT AREA NOT VERIFIED/);
  assert.match(client, /CLEARER VIEW NEEDED/);
  assert.match(client, /6000/);
  assert.match(client, /psCinemaFx/);
  assert.match(client, /bullseye-events/);
  assert.match(client, /bullseye-levels/);
  assert.match(client, /bullseye-evidence/);
  assert.match(client, /bullseye-feedback/);
  assert.match(client, /psReportRail/);
  assert.doesNotMatch(client, /READ THE FULL RESULT STORY/);
  assert.match(client, /CINEMATIC RESULT/);
  assert.match(client, /WRITTEN REPORT/);
  assert.match(client, /CHAPTER 02 · VERIFIED EVIDENCE/);
  assert.match(client, /SWING MAP/);
  assert.match(client, /THE PRICE BATTLEFIELD/);
  assert.match(client, /OPEN FULL WRITTEN REPORT/);
  assert.match(client, /psStoryFinale/);
  assert.match(client, /EVIDENCE BALANCE · NOT PROBABILITY/);
  assert.match(client, /personalDailyMessage/);
  assert.match(client, /YOUR MESSAGE FOR TODAY/);
  assert.doesNotMatch(client, /CinematicTranscript/);
  assert.match(client, /psFinaleRatioCards/);
  assert.match(client, /EVIDENCE BALANCE/);
  assert.match(client, /REPORT A PROBLEM/);
  assert.match(client, /SUGGEST AN IDEA/);
  assert.match(client, /mailto:hello@nashaimarkets\.com/);
  assert.match(client, /INVITE A TRADER/);
  assert.match(client, /\/join/);
  assert.match(client, /navigator\.share/);
  assert.match(client, /navigator\.clipboard\.writeText/);
  assert.match(feedbackStyles, /\.psFeedback/);
  assert.match(cinemaStyles, /\.psCinemaFx/);
  assert.match(cinemaStyles, /@keyframes psProLensSweep/);
  assert.match(cinemaStyles, /prefers-reduced-motion/);
  assert.match(eventsRoute, /if \(returnedSymbol !== symbol\) return \[\]/);
  assert.doesNotMatch(client, /className="psChartLineLabel"/);
  assert.match(styles, /\.psResultReveal\{/);
  assert.match(styles, /\.psBattleLevel/);
  assert.match(styles, /\.psBattleIntel/);
  assert.match(styles, /\.psBattleRoutes/);
  assert.match(styles, /\.psScenarioFocus/);
  assert.match(styles, /\.psBattleTabs/);
  assert.match(styles, /\.psPriceLadder/);
  assert.match(styles, /\.psDecisionRange/);
  assert.match(styles, /\.psMapIntro/);
  assert.match(styles, /\.psAuditDrawer/);
  assert.match(styles, /\.psClarityLock/);
  assert.match(styles, /\.psBullseyePlan/);
  assert.match(styles, /\.psResultCardModal/);
  assert.match(styles, /\.psScenarioTheatre/);
  assert.match(styles, /\.psScenarioPanel/);
  assert.match(styles, /\.psScenarioSource/);
  assert.match(styles, /\.psNextCandleCanvas/);
  assert.match(styles, /\.psDecisionEvents/);
  assert.match(styles, /\.psDecisionMapEmpty/);
  assert.match(commandStyles, /\.psChartXRay/);
  assert.match(commandStyles, /\.psXRayCanvas/);
  assert.match(commandStyles, /\.psXRayPatterns/);
  assert.match(client, /pattern\.geometry/);
  assert.match(client, /psXRayPatternLabels/);
  assert.match(client, /1 FOCUSED TOOL/);
  assert.match(client, /drawablePatterns/);
  assert.doesNotMatch(client, /visualAreas/);
  assert.match(client, /psClarityClassic/);
  assert.match(client, /psClarityBars/);
  assert.doesNotMatch(client, /psLockCore/);
  assert.match(styles, /\.psMarketStory/);
  assert.match(styles, /\.psStoryProgress/);
  assert.match(styles, /@keyframes psStoryKenBurns/);
  assert.match(styles, /\.psPersonalTouch/);
  assert.match(styles, /\.psDecisionCompass,\.psApp \.psNextSequence/);
  assert.match(styles, /\.psDecisionMap\.psBattlefieldExpanded\.psDecisionMapEmpty/);
  assert.match(styles, /\.psStoryLinks/);
  assert.match(styles, /\.psMissingLevelCue/);
  assert.match(styles, /\.psResultViewSwitch/);
  assert.match(styles, /@keyframes psScoreSlam/);
  assert.match(styles, /@keyframes psFinaleShock/);
  assert.match(styles, /@keyframes psLogoSlam/);
  assert.match(styles, /\.psEvidenceRatio/);
  assert.match(styles, /\.psDailyMessage/);
  assert.match(styles, /\.psFinalePage/);
  assert.match(styles, /@keyframes psBullEnter/);
  assert.match(styles, /@keyframes psBearEnter/);
  assert.doesNotMatch(client, /className="psToolDock"/);
  assert.doesNotMatch(client, /ChartOverlay/);
  assert.match(analyseRoute, /"x", "y", "x2", "y2"/);
  assert.match(analyseRoute, /Trend uses two visible swing anchors/);
  assert.match(styles, /\.psApp \.psMissingInputs>footer/);
  assert.match(styles, /min-height:44px/);
  assert.match(reviewRoute, /MAX_IMAGE_LENGTH = 11_000_000/);
  for (const route of [analyseRoute, reviewRoute, followUpRoute]) {
    assert.match(route, /store: false/);
    assert.match(route, /pocketBudgetHeaders/);
  }
});

test("Decision Map withholds absent structure but keeps one-sided evidence explicitly partial", async () => {
  const [client, precisionStyles] = await Promise.all([
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-precision-overhaul.css", import.meta.url), "utf8"),
  ]);
  const decisionMap = client.slice(client.indexOf("function DecisionMap"), client.indexOf("function SourceChart"));
  const earlyHold = decisionMap.indexOf("if (current === null || !verifiedStructure.length)");
  const firstMapPrimitive = decisionMap.indexOf("psBattleCurrent");
  assert.ok(earlyHold >= 0 && firstMapPrimitive > earlyHold, "an empty exact map must return before map primitives render");
  assert.match(decisionMap, /hasContext \? "NO VERIFIED TWO-SIDED LEVELS" : "EXACT LEVELS NOT VERIFIED"/);
  assert.match(decisionMap, /NO ESTIMATED LEVELS · NO HIDDEN MAP/);
  assert.match(decisionMap, /PARTIAL PRICE MAP/);
  assert.match(decisionMap, /data-structure=\{twoSided \? "two-sided" : "partial"\}/);
  assert.match(decisionMap, /support is verified; resistance still needs a clearer view/i);
  assert.doesNotMatch(decisionMap, /onReanalyse|reanalysing|ADD ANOTHER PHOTO/);
  assert.match(precisionStyles, /\.psDecisionMapHold \{/);
  assert.match(precisionStyles, /min-height: 250px/);
  assert.match(precisionStyles, /@media \(max-width: 520px\)/);
});

test("full-screen Decision Map keeps two independent exits inside the safe viewport", async () => {
  const [client, page, hotfix] = await Promise.all([
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-v1-1-hotfix.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /viewportFit: "cover"/);
  assert.match(client, /className="psBattleFocusBody" ref=\{chartFocusScroll\}/);
  assert.match(client, /psBattleBackToResult/);
  assert.match(client, /event\.key === "Escape"/);
  assert.match(hotfix, /\.psBattleFocus \{ overflow: hidden; \}/);
  assert.match(hotfix, /\.psBattleFocusBody[\s\S]*overflow: auto/);
  assert.match(hotfix, /\.psBattleFocus > header button \{ min-width: 64px; min-height: 44px; \}/);
  assert.match(client, /<main className="psApp" data-pocket-build="v3\.2" data-chart-focus=\{chartFocus \? "true" : "false"\}>/);
  assert.match(hotfix, /\.psApp\[data-chart-focus="true"\],[\s\S]*\.psResults\[data-chart-focus="true"\] \{ perspective: none; \}/);
  assert.match(hotfix, /\.psXRayCanvas > img[\s\S]*height: auto[\s\S]*object-fit: contain/);
});

test("server beta budgets stop duplicate cost before the provider is called", () => {
  resetPocketBudgetsForTesting();
  const request = new Request("https://example.test/api/pocket/analyse", { headers: { "x-forwarded-for": "192.0.2.10" } });
  const results = Array.from({ length: 5 }, () => takePocketBudget(request, "analyse", 1_000));
  assert.deepEqual(results.slice(0, 4).map((result) => result.allowed), [true, true, true, true]);
  assert.equal(results[4].allowed, false);
  assert.equal(results[4].remaining, 0);
  assert.ok(results[4].retryAfterSeconds > 0);
});

test("beta budgets are isolated by action and requester and reset after the window", () => {
  resetPocketBudgetsForTesting();
  const first = new Request("https://example.test", { headers: { "x-forwarded-for": "192.0.2.11" } });
  const second = new Request("https://example.test", { headers: { "x-forwarded-for": "192.0.2.12" } });
  assert.equal(takePocketBudget(first, "review", 1_000).remaining, 2);
  assert.equal(takePocketBudget(first, "follow-up", 1_000).remaining, 9);
  assert.equal(takePocketBudget(second, "review", 1_000).remaining, 2);
  assert.equal(takePocketBudget(first, "review", 1_000 + 31 * 60_000).remaining, 2);
});
