import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { deriveAnalysisMaps, type DecisionIntelligenceAnalysis } from "../app/pocket/pocket-decision-intelligence.ts";

const analysis: DecisionIntelligenceAnalysis = {
  direction: "BULLISH",
  confidence: "MEDIUM",
  timeframe: "1H",
  currentPrice: "6010",
  evidenceQuality: { chartReadability: "CLEAR", scaleReadable: true, candlesReadable: true },
  observableFacts: ["Higher highs remain visible", "RSI 58 is visible"],
  contradictions: ["Latest push has weaker momentum"],
  higherTimeframe: { provided: true, timeframe: "4H", direction: "BEARISH", alignment: "CONFLICTING", summary: "The 1H bounce remains below 4H resistance." },
  patterns: [{ name: "BULL FLAG", status: "FORMING", confidence: "MEDIUM", evidence: "A compact pullback follows the visible impulse.", confirmation: "The flag boundary breaks and holds.", invalidation: "The impulse base fails." }],
  nextSequence: { now: "Price is testing support.", confirmation: "Reclaim and hold above resistance.", failure: "Support closes below.", patience: "Price remains inside the range.", reassess: "After the next confirmed break." },
  setupScore: { overall: 68, structure: 7, momentum: 6, location: 7, confirmation: 5, riskClarity: 8, eventSafety: 4 },
  traderTrap: "A long entry before the reclaim risks buying directly into resistance.",
  bullishCase: "Support holds and price reclaims resistance.",
  bearishCase: "The bounce fails below higher-timeframe supply.",
  marketStructure: "Higher highs and higher lows remain visible on the 1H chart.",
  momentum: "RSI 58 is visible but the latest push is fading.",
  noTradeCondition: "Stand aside while price remains mid-range.",
  riskFlags: ["Higher-timeframe conflict"],
  indicators: ["RSI 58"],
  levels: [
    { kind: "support", label: "Defended low", price: "5980" },
    { kind: "resistance", label: "Range high", price: "6040" },
    { kind: "pivot", label: "Swing low", price: "5960" },
  ],
};

test("the map suite exposes every authorised view without fabricating missing inputs", () => {
  const maps = deriveAnalysisMaps(analysis);
  assert.deepEqual(maps.map((map) => map.id), ["liquidity", "structure", "timeframes", "momentum", "volatility", "sessions", "auction", "patterns", "confluence", "conditions"]);
  assert.equal(maps.find((map) => map.id === "structure")?.headline, "HIGHER-HIGH / HIGHER-LOW SEQUENCE");
  assert.equal(maps.find((map) => map.id === "sessions")?.status, "MORE INPUT NEEDED");
  assert.equal(maps.find((map) => map.id === "auction")?.status, "MORE INPUT NEEDED");
  assert.equal(maps.find((map) => map.id === "volatility")?.status, "MORE INPUT NEEDED");
  assert.match(maps.find((map) => map.id === "liquidity")?.summary ?? "", /buying directly into resistance/i);
  assert.equal(maps.find((map) => map.id === "timeframes")?.headline, "CONFLICTING TIMEFRAME READ");
});

test("missing indicators and suggested uploads never become visible evidence", () => {
  const maps = deriveAnalysisMaps({ ...analysis, observableFacts: [], indicators: [],
    marketStructure: "No opening range or overnight range is visible.",
    momentum: "No RSI or MACD indicator is visible. ATR and Bollinger Bands are not supplied. No compression or expansion is confirmed.",
    traderTrap: "VWAP would help identify a trap.", riskFlags: ["Add volume profile, point of control and value area."] });
  for (const id of ["volatility", "sessions", "auction"]) assert.equal(maps.find((map) => map.id === id)?.status, "MORE INPUT NEEDED");
  assert.equal(maps.find((map) => map.id === "momentum")?.readings.find((reading) => reading.label === "VISIBLE INDICATOR")?.value, "NOT VERIFIED");
  for (const id of ["volatility", "auction"]) assert.ok(maps.find((map) => map.id === id)?.readings.every((reading) => reading.value === "NOT VERIFIED"));
});

test("affirmative observations survive separately from negative and conditional clauses", () => {
  const maps = deriveAnalysisMaps({ ...analysis, observableFacts: ["RSI 58 is visible, but MACD is not supplied.", "Bollinger Bands are plotted.", "The London session opening range is marked.", "VWAP and the volume profile point of control are visible."],
    indicators: [], momentum: "ATR might reveal expansion if supplied.", marketStructure: "A range is visible." });
  for (const id of ["volatility", "sessions", "auction"]) assert.equal(maps.find((map) => map.id === id)?.status, "EVIDENCE READY");
  assert.equal(maps.find((map) => map.id === "momentum")?.readings.find((reading) => reading.label === "VISIBLE INDICATOR")?.value, "PRESENT");
  assert.equal(maps.find((map) => map.id === "volatility")?.readings.find((reading) => reading.label === "EXPANSION")?.value, "NOT VERIFIED");
});

test("unrelated words do not match short indicator abbreviations", () => {
  const maps = deriveAnalysisMaps({ ...analysis, observableFacts: ["A matrix of candles is visible."], indicators: [], momentum: "Sideways movement.", marketStructure: "Range.", traderTrap: "Wait.", riskFlags: [] });
  assert.equal(maps.find((map) => map.id === "volatility")?.status, "MORE INPUT NEEDED", "matrix must not match ATR");
});

test("the AI never receives the trader's long or short choice", async () => {
  const [route, client] = await Promise.all([
    readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /intended direction is deliberately withheld/);
  assert.doesNotMatch(route, /Trader is considering/);
  assert.doesNotMatch(route, /payload\.intention/);
  assert.doesNotMatch(client, /body: JSON\.stringify\(\{ image, contextImage: selectedContext, precisionImage, contextPrecisionImage, intention/);
  assert.doesNotMatch(client, /BlindBiasReveal|TrustGateCard/);
});

test("one primary chart enables analysis and supporting views stay optional", async () => {
  const [route, client, styles] = await Promise.all([
    readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-launch-v13.css", import.meta.url), "utf8"),
  ]);
  for (const label of ["① UPLOAD ONE CHART", "OPTIONAL SUPPORTING CHARTS", "ADD PICTURES TOGETHER", "CHANGE"]) assert.match(client, new RegExp(label));
  assert.match(client, /detailImage: providerDetailImage, fourHourImage: providerFourHourImage, indicatorImage: providerIndicatorImage/);
  assert.match(client, /\{evidenceImageCount\}\/5 CHARTS LOADED/);
  assert.match(client, /const primaryChartReady = Boolean\(image\)/);
  assert.match(client, /UPLOAD ONE CHART/);
  for (const role of ["PRIMARY", "HIGHER_TIMEFRAME", "PRICE_DETAIL", "FOUR_HOUR", "INDICATOR_VOLUME"]) assert.match(route, new RegExp(role));
  assert.doesNotMatch(route, /EXPECTED TIMEFRAME|four required timeframe/);
  assert.match(await readFile(new URL("../app/api/pocket/preflight/route.ts", import.meta.url), "utf8"), /top-level timeframe must be the exact visibly printed image-1 label/);
  assert.match(await readFile(new URL("../app/api/pocket/preflight/route.ts", import.meta.url), "utf8"), /complete retake instruction under 140 characters/);
  assert.match(route, /Supporting images can refine the written audit but must never replace image 1's coordinate system/);
  assert.match(route, /never inflate score or confidence because more images were uploaded/);
  assert.match(route, /expectedEvidenceRoles/);
  assert.match(styles, /\.psEvidencePack/);
  assert.match(styles, /\.psEvidenceContribution/);
});

test("decision autopsy persists the later evidence and fails closed on root cause", async () => {
  const [route, client, compatibility] = await Promise.all([
    readFile(new URL("../app/api/pocket/review/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/decision-compatibility.ts", import.meta.url), "utf8"),
  ]);
  for (const field of ["thesisStatus", "structureShift", "rootCause", "evidenceChanges", "nextRule"]) assert.match(route, new RegExp(field));
  assert.match(route, /rootCause=NOT_PROVEN unless/);
  assert.match(client, /await vaultSave\(completedDecision\)/);
  assert.match(client, /CHART CHANGE DETECTOR/);
  assert.match(client, /SetupNotebook/);
  assert.match(await readFile(new URL("../app/pocket/SetupNotebook.tsx", import.meta.url), "utf8"), /Patterns in my reviews/);
  assert.match(compatibility, /afterImage/);
  assert.match(compatibility, /reviewedAt/);
});

test("a partial swing description cannot certify the complete sequence", () => {
  const maps = deriveAnalysisMaps({ ...analysis, marketStructure: "Higher highs are visible but higher lows are not confirmed.", observableFacts: [] });
  assert.equal(maps.find((map) => map.id === "structure")?.headline, "SWING SEQUENCE NOT LABELLED");
});
