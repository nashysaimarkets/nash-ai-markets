import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";
import { normalizeLockedDecision, normalizeLockedDecisions } from "../app/pocket/decision-compatibility.ts";
import { resetPocketBudgetsForTesting, takePocketBudget } from "../app/lib/server/pocket-request-budget.ts";

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

test("the complete Pocket journey retains privacy, failure and duplicate-request safeguards", async () => {
  const [client, styles, analyseRoute, reviewRoute, followUpRoute] = await Promise.all([
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-launch-v16.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pocket/review/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pocket/follow-up/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /analysisRequestActive\.current/);
  assert.match(client, /followUpRequestActive\.current/);
  assert.match(client, /PRIVACY SHIELD/);
  assert.match(client, /NO ORDER CONNECTION/);
  assert.match(client, /normalizeLockedDecisions/);
  assert.match(client, /addResultContextFile/);
  assert.match(client, /Add a supporting chart photo/);
  assert.match(client, /requestPocketAnalysis\(prepared\)/);
  assert.match(client, /Keeping this result open while Bullseye refines it/);
  assert.doesNotMatch(client, /setAnalysis\(null\)[\s\S]{0,120}Supporting chart added/);
  assert.match(client, /psChartOverlayLayer/);
  assert.match(client, /Full-screen chart overlays/);
  assert.match(client, /aria-pressed=\{visibleOverlays\.has\(overlay\)\}/);
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
