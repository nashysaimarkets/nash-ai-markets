import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";
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
    priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7600, y: 70 }],
    levels: [{ kind: "support", label: "Support", price: "7700", x: 0, y: 2, x2: 1, y2: 2 }],
  }) as { levels: Array<{ x: number; y: number; x2: number; y2: number }> };
  assert.deepEqual(calibrated.levels[0], { kind: "support", label: "Support", price: "7700", x: 20, y: 45, x2: 82, y2: 45 });
});

test("unverified or out-of-scale horizontal levels fail closed", () => {
  const base = {
    evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true },
    setupScore: { overall: 70, grade: "B" },
    plotBounds: { left: 20, top: 15, right: 82, bottom: 80 },
  };
  const noAnchors = calibratePocketAnalysis({ ...base, priceScaleAnchors: [], levels: [{ kind: "support", price: "7700", y: 45 }] }) as { levels: unknown[] };
  const outsideScale = calibratePocketAnalysis({ ...base, priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7600, y: 70 }], levels: [{ kind: "resistance", price: "8100", y: 12 }] }) as { levels: unknown[] };
  assert.deepEqual(noAnchors.levels, []);
  assert.deepEqual(outsideScale.levels, []);
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
  const [client, styles, feedbackStyles, cinemaStyles, analyseRoute, reviewRoute, followUpRoute, eventsRoute] = await Promise.all([
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-launch-v16.css", import.meta.url), "utf8"),
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
  assert.match(client, /pocket-analysis-v1/);
  assert.match(client, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(client, /analysisCacheGet\(cacheKey\)/);
  assert.match(client, /analysisCacheSave\(cacheKey, payload\.analysis\)/);
  assert.match(client, /addResultContextFile/);
  assert.match(client, /Add a supporting chart photo/);
  assert.match(client, /requestPocketAnalysis\(prepared\)/);
  assert.match(client, /Keeping this result open while Bullseye refines it/);
  assert.match(client, /SECOND VIEW RESULT/);
  assert.match(client, /psRefineDelta/);
  assert.match(analyseRoute, /contextContribution/);
  assert.match(analyseRoute, /Never request entry, stop, target/);
  assert.doesNotMatch(client, /setAnalysis\(null\)[\s\S]{0,120}Supporting chart added/);
  assert.match(client, /DecisionMap/);
  assert.match(client, /Bullseye Decision Map/);
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
  assert.match(client, /VIEW CONDITIONS/);
  assert.match(client, /SHOW ON DECISION MAP/);
  assert.match(client, /aria-pressed=\{selectedScenario === "bull"\}/);
  assert.match(client, /battlefieldChart/);
  assert.match(client, /Choose chart for Bullseye Decision Map/);
  assert.match(client, /contextBattlefield/);
  assert.match(client, /Calibrated Decision Map price ladder/);
  assert.match(client, /FULL EVIDENCE AUDIT/);
  assert.match(client, /DETAILED MARKET AUDIT/);
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
  assert.match(client, /SPECULATIVE ONLY/);
  assert.match(client, /ABOVE SUPPORT · BELOW RESISTANCE/);
  assert.match(client, /<ScenarioTheatre analysis=/);
  assert.match(client, /ConfluenceStack/);
  assert.match(client, /BULLSEYE CONFLUENCE STACK/);
  assert.match(client, /FIVE EVIDENCE LAYERS/);
  assert.match(client, /<ConfluenceStack analysis=/);
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
  assert.match(client, /EVENT IMPACT CHECK/);
  assert.match(client, /psResultSupportInput/);
  assert.match(client, /could not be verified safely/);
  assert.match(client, /ADD ANOTHER PHOTO/);
  assert.match(client, /reanalyseResult/);
  assert.match(client, /↻ REANALYSE/);
  assert.match(client, /SUPPORT AREA NOT VERIFIED/);
  assert.match(client, /CLEARER VIEW NEEDED/);
  assert.match(client, /6000/);
  assert.match(client, /psCinemaFx/);
  assert.match(client, /bullseye-events/);
  assert.match(client, /bullseye-levels/);
  assert.match(client, /bullseye-evidence/);
  assert.match(client, /CINEMATIC RESULT/);
  assert.match(client, /WRITTEN REPORT/);
  assert.match(client, /CHAPTER 02 · VERIFIED EVIDENCE/);
  assert.match(client, /STRUCTURE & MOMENTUM/);
  assert.match(client, /THE PRICE BATTLEFIELD/);
  assert.match(client, /OPEN FULL WRITTEN REPORT/);
  assert.match(client, /psStoryFinale/);
  assert.match(client, /EVIDENCE BALANCE · NOT PROBABILITY/);
  assert.match(client, /personalDailyMessage/);
  assert.match(client, /YOUR MESSAGE FOR TODAY/);
  assert.match(client, /CinematicTranscript/);
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
  assert.match(styles, /\.psConfluenceStack/);
  assert.match(styles, /\.psLayerDeck/);
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
