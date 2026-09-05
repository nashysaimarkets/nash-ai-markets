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
