import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { postLiquidityRescan } from "../app/pocket/liquidity-rescan-client.ts";

const route = readFileSync("app/api/pocket/liquidity/route.ts", "utf8");
const client = readFileSync("app/pocket/PocketBullseye.tsx", "utf8");
const depth = readFileSync("app/pocket/pocket-future-depth.css", "utf8");
const hotfix = readFileSync("app/pocket/pocket-v1-1-hotfix.css", "utf8");

test("Liquidity Guard has a dedicated bounded primary-chart rescan", () => {
  assert.match(client, /async function rescanLiquidityOnly/);
  assert.match(client, /postLiquidityRescan/);
  assert.match(client, /onLiquidityRescan={rescanLiquidityOnly}/);
  assert.match(route, /Analyse only the uploaded primary chart/);
  assert.match(route, /instrumentIdentitiesMatch/);
  assert.match(route, /timeframeConfidence === "HIGH" && compatibleTimeframe/);
  assert.match(route, /normalizePrecisionLiquidityShield/);
  assert.match(route, /raw\.candlesReadable !== true \|\| raw\.priceScaleReadable !== true \|\| raw\.confidence === "LOW"/);
  assert.match(route, /reasoning: \{ effort: "low" \}/);
  assert.match(route, /inFlight\.set\(key, work\)/);
  assert.doesNotMatch(route, /signal: request\.signal/);
  assert.match(route, /classifyOpenAIFailure/);
  assert.match(client, /activePrimaryImage\.current !== sourceImageRevision/);
  assert.match(client, /const effectiveLiquidity = effectiveLiquidityGeometry\(analysis\)/);
  assert.match(client, /createMeasuredScanImage/);
  assert.match(client, /measuredScanImage/);
  assert.match(route, /cyan pixel-locked ruler/);
  assert.match(route, /independentCalibration: true/);
});

test("a completed main scan automatically invokes independent recovery when precision was withheld", () => {
  const request = client.slice(client.indexOf("async function requestPocketAnalysis"), client.indexOf("async function analyse()"));
  assert.match(request, /needsLevelRecovery = !hasVerifiedTwoSidedStructure/);
  assert.match(request, /needsLiquidityRecovery = completedAnalysis\.liquidityShield\?\.status !== "VISIBLE_RISK_ZONES"/);
  assert.match(request, /postLevelLabScan/);
  assert.match(request, /postLiquidityRescan/);
  assert.match(request, /const \[levelRecovery, liquidityRecovery\] = await Promise\.all/);
  assert.match(request, /liquidityGeometry: liquidityRecovery\.payload\.liquidity/);
  assert.doesNotMatch(request, /setLevelLabImage|setLevelLabFileName/);
});

test("async chart uploads retain the input before React releases the event", () => {
  const uploads = client.slice(client.indexOf("async function loadFile"), client.indexOf("async function rescanLevelsOnly"));
  for (const handler of ["loadFile", "loadContextFile", "loadDetailFile", "loadFourHourFile", "loadIndicatorFile", "addResultContextFile", "addLevelLabFile"]) {
    const start = uploads.indexOf(`async function ${handler}`);
    const next = uploads.indexOf("\n  async function ", start + 1);
    const body = uploads.slice(start, next === -1 ? undefined : next);
    assert.notEqual(start, -1, `${handler} must exist`);
    assert.match(body, /const input = event\.currentTarget/, `${handler} must retain its input synchronously`);
    assert.equal(body.match(/event\.currentTarget/g)?.length, 1, `${handler} must not revisit the React event`);
    assert.doesNotMatch(body, /event\.target/, `${handler} must not use an unretained event target`);
    assert.match(body, /input\.value = "";/, `${handler} must release same-file selection`);
  }
});

test("new chart and review transitions cannot reuse a prior four-hour upload", () => {
  const review = client.slice(client.indexOf("async function startReview"), client.indexOf("function startNewChart"));
  const next = client.slice(client.indexOf("function startNewChart"), client.indexOf("const sourceChart"));
  assert.match(review, /setFourHourImage\(null\); setFourHourFileName\(""\)/);
  assert.match(next, /setFourHourImage\(null\);/);
  assert.match(next, /setFourHourFileName\(""\);/);
});

test("an accuracy correction invalidates dedicated Guard geometry", () => {
  const correction = client.slice(client.indexOf("function applyAccuracyCorrection"), client.indexOf("async function reanalyseWithCorrection"));
  assert.match(correction, /liquidityShield: undefined, liquidityGeometry: undefined/);
});

test("Liquidity rescan retries a transient response with one correlation id", async () => {
  const ids: string[] = [];
  let calls = 0;
  const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    ids.push(new Headers(init?.headers).get("x-pocket-request-id") ?? "");
    return calls === 1
      ? new Response(JSON.stringify({ error: "retry" }), { status: 502 })
      : new Response(JSON.stringify({ liquidity: { liquidityShield: { status: "NO_VISIBLE_RISK_ZONES", zones: [] } } }), { status: 200 });
  };
  const result = await postLiquidityRescan<{ liquidity?: unknown }>("{}", fetcher);
  assert.equal(result.response.status, 200);
  assert.equal(calls, 2);
  assert.ok(ids[0]);
  assert.equal(ids[0], ids[1]);
});

test("mobile Decision Map reserves its content header and removes colliding labels", () => {
  assert.match(client, /Math\.abs\(y - currentY\) < 8/);
  assert.match(client, /visible\.some\(\(candidate\) => Math\.abs\(position\(candidate\.numericPrice\) - y\) < 8\)/);
  assert.match(hotfix, /\.psDecisionMap \.psMapIntro \{ min-height: 108px; \}/);
  assert.match(hotfix, /\.psDecisionMap \.psBattleIntel \{ top: 142px; \}/);
  assert.match(hotfix, /\.psDecisionMap \.psBattleLevel em \{ display: none; \}/);
  assert.match(hotfix, /\.psDecisionMap \.psBattleLevel small \{ right: 96px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; \}/);
  assert.match(client, /`\$\{nearestSupport\.price\} · \$\{formatPercent\(supportDistance\)\}`/);
  assert.doesNotMatch(depth, /min-height: 108px|\.psDecisionMap \.psBattleIntel \{ top:/);
});
