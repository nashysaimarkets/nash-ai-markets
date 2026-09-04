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
  liquidityShield: {
    status: "VISIBLE_RISK_ZONES",
    summary: "Repeated highs form a visible stop-risk area above current price.",
    zones: [{ side: "ABOVE_PRICE", pattern: "EQUAL_HIGHS", label: "Equal highs", priceLow: 6040, priceHigh: 6044, touchPoints: [{ x: 35, y: 20 }, { x: 70, y: 20 }], confidence: "HIGH", evidence: "Two separated highs touch the same scale-checked band." }],
    stopGuidance: "Keep invalidation beyond the verified cluster rather than inside it.",
  },
};

test("the map suite exposes every authorised view without fabricating missing inputs", () => {
  const maps = deriveAnalysisMaps(analysis);
  assert.deepEqual(maps.map((map) => map.id), ["liquidity", "structure", "timeframes", "momentum", "volatility", "sessions", "auction", "patterns", "confluence", "conditions"]);
  assert.equal(maps.find((map) => map.id === "sessions")?.status, "MORE INPUT NEEDED");
  assert.equal(maps.find((map) => map.id === "auction")?.status, "MORE INPUT NEEDED");
  assert.equal(maps.find((map) => map.id === "volatility")?.status, "MORE INPUT NEEDED");
  assert.equal(maps.find((map) => map.id === "liquidity")?.headline, "1 VISIBLE STOP-RISK AREA");
  assert.equal(maps.find((map) => map.id === "liquidity")?.readings.find((reading) => reading.label === "ABOVE PRICE")?.value, "6040–6044");
  assert.equal(maps.find((map) => map.id === "timeframes")?.headline, "CONFLICTING TIMEFRAME READ");
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
  assert.doesNotMatch(client, /BLIND BIAS CHALLENGE/);
});

test("visible result surfaces expose liquidity, pattern and macro outcomes before opening individual tools", async () => {
  const [route, client, styles] = await Promise.all([
    readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-v1-3-visible-scans.css", import.meta.url), "utf8"),
  ]);
  assert.match(route, /\{ analysis: finalAnalysis, macroContext \}/);
  assert.match(client, /THREE CHECKS COMPLETED/);
  assert.match(client, /className="psScanSummary"/);
  assert.match(client, /LIQUIDITY GUARD/);
  assert.match(client, /PATTERN WATCH/);
  assert.match(client, /MACRO CHECK/);
  assert.match(client, /FEED UNAVAILABLE/);
  assert.match(client, /NONE RETURNED/);
  assert.match(styles, /\.psScanSummary/);
  assert.match(styles, /\.psStoryScans/);
});

test("the guided evidence pack accepts four purpose-labelled charts without mixing coordinate systems", async () => {
  const [route, client, styles] = await Promise.all([
    readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-launch-v13.css", import.meta.url), "utf8"),
  ]);
  for (const label of ["SECOND / HIGHER TIMEFRAME", "THIRD TIMEFRAME / PRICE DETAIL", "VOLUME / INDICATOR / TIMEFRAME"]) assert.match(client, new RegExp(label));
  assert.match(client, /detailImage: providerDetailImage, indicatorImage: providerIndicatorImage/);
  assert.match(client, /\{evidenceImageCount\}\/4 CHARTS READY/);
  assert.match(client, /Every supporting image is assessed separately/);
  for (const role of ["PRIMARY", "HIGHER_TIMEFRAME", "PRICE_DETAIL", "INDICATOR_VOLUME"]) assert.match(route, new RegExp(role));
  assert.match(route, /Supporting images can refine the written audit but must never replace image 1's coordinate system/);
  assert.match(route, /never inflate score or confidence because more images were uploaded/);
  assert.match(route, /expectedEvidenceRoles/);
  assert.match(styles, /\.psEvidencePack/);
  assert.match(styles, /\.psEvidenceContribution/);
});

test("structured volume evidence works without pretending volume bars are a full profile", () => {
  const maps = deriveAnalysisMaps({
    ...analysis,
    auctionProfile: {
      supplied: true,
      sourceRole: "INDICATOR_VOLUME",
      timeframe: "1H",
      volumeBarsVisible: true,
      volumeProfileVisible: false,
      valueAreaHigh: "",
      valueAreaLow: "",
      pointOfControl: "",
      vwap: "",
      volumeRead: "Volume expands on the latest downside candle.",
      evidence: "A separate vertical volume panel is clearly visible.",
      limitation: "No horizontal profile, POC or value-area labels are visible.",
    },
  });
  const auction = maps.find((map) => map.id === "auction");
  assert.equal(auction?.status, "EVIDENCE READY");
  assert.equal(auction?.headline, "VOLUME EVIDENCE FOUND");
  assert.equal(auction?.readings.find((reading) => reading.label === "VOLUME BARS")?.value, "VISIBLE");
  assert.equal(auction?.readings.find((reading) => reading.label === "PROFILE / VALUE")?.value, "NOT VERIFIED");
});

test("structured missing-volume result cannot be flipped by negative prose keywords", () => {
  const maps = deriveAnalysisMaps({
    ...analysis,
    indicators: ["Volume profile not supplied; POC not verified."],
    auctionProfile: {
      supplied: false,
      sourceRole: "NONE",
      timeframe: "",
      volumeBarsVisible: false,
      volumeProfileVisible: false,
      valueAreaHigh: "",
      valueAreaLow: "",
      pointOfControl: "",
      vwap: "",
      volumeRead: "",
      evidence: "No volume panel is visible.",
      limitation: "Volume evidence was not supplied.",
    },
  });
  const auction = maps.find((map) => map.id === "auction");
  assert.equal(auction?.status, "MORE INPUT NEEDED");
  assert.equal(auction?.readings.find((reading) => reading.label === "POC")?.value, "NOT VERIFIED");
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
  assert.match(client, /YOUR MISTAKE FINGERPRINT/);
  assert.match(compatibility, /afterImage/);
  assert.match(compatibility, /reviewedAt/);
});
