import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const client = readFileSync("app/pocket/PocketBullseye.tsx", "utf8");
const route = readFileSync("app/api/pocket/levels/route.ts", "utf8");

test("Liquidity Guard and Signal Pulse remain separate command tools", () => {
  assert.match(client, /number: "02", label: "LIQUIDITY GUARD"/);
  assert.match(client, /number: "07", label: "SIGNAL PULSE"/);
  assert.match(client, /WHAT IS DEVELOPING NOW/);
});

test("Level Lab exposes a separate photo and levels-only rescan", () => {
  assert.match(client, /INDEPENDENT LEVEL LAB/);
  assert.match(client, /RESCAN LEVELS ONLY/);
  assert.match(client, /fetch\("\/api\/pocket\/levels"/);
});

test("Level Lab merges only price-map fields into the existing analysis", () => {
  const merge = client.slice(client.indexOf("async function rescanLevelsOnly"), client.indexOf("async function reanalyseResult"));
  assert.match(merge, /setAnalysis\(\(current\)/);
  for (const protectedField of ["verdict:", "patterns:", "setupScore:", "nextSequence:", "riskFlags:"]) assert.doesNotMatch(merge, new RegExp(protectedField));
  assert.match(merge, /liquidityShield: undefined/);
});

test("independent endpoint fails closed on prices but preserves visible reaction areas", () => {
  assert.match(route, /Exact numeric prices require at least two widely separated readable scale labels/);
  assert.match(route, /empty price string/);
  assert.match(route, /Do not produce or change a verdict, pattern, scenario, score, direction, plan or risk assessment/);
});

test("Pocket shows a same-day official macro calendar in UK time", () => {
  assert.match(client, /TODAY · UK TIME/);
  assert.match(client, /OFFICIAL US MACRO SCHEDULE/);
  assert.match(client, /Europe\/London/);
  assert.match(client, /No scheduled BLS, BEA or Federal Reserve release was returned for today/);
});
