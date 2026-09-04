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

test("the redundant Level Lab upload is replaced by a compact verified summary", () => {
  assert.doesNotMatch(client, /INDEPENDENT LEVEL LAB|RESCAN LEVELS ONLY|postLevelLabScan|createLevelLabScanImage/);
  assert.match(client, /INDEPENDENT TIMEFRAME READS/);
  assert.match(client, /TOGGLE EACH BOX TO CHECK ITS OWN RESULT/);
  assert.match(client, /function TimeframeLevelExplorer/);
});

test("independent endpoint fails closed on bad identity, price, scale and geometry while preserving an exact visible side", () => {
  assert.match(route, /validateLevelLabPrimaryProvenance/);
  assert.match(route, /validateLevelLabScan/);
  assert.match(route, /instrumentIdentifier/);
  assert.match(route, /candlesReadable/);
  assert.match(route, /priceScaleReadable/);
  assert.match(route, /Exact numeric prices require at least two widely separated readable scale labels/);
  assert.match(route, /Never copy the expected identity from the prompt unless it is independently visible/);
  assert.match(route, /never authorises replacing the verified primary price/);
  assert.doesNotMatch(route, /still return the strongest visual support and resistance areas/);
  assert.doesNotMatch(route, /JSON\.parse\(output\) \}/);
  assert.match(route, /Do not produce or change a verdict, pattern, scenario, score, direction, plan or risk assessment/);
  assert.match(route, /if only one side is visible return that exact side and leave the missing side absent/i);
  assert.match(route, /inFlightLevelLabRequests\.set\(completedKey, providerWork\)/);
  assert.match(route, /rememberCompletedRequest\(completedKey, result\)/);
  assert.match(route, /inFlightLevelLabRequests\.delete\(completedKey\)/);
  assert.match(route, /LEVEL_LAB_REPLAY_MAX_ENTRIES = 64/);
  assert.match(route, /signal: providerController\.signal/);
  assert.doesNotMatch(route, /signal: request\.signal/);
});

test("Pocket shows a same-day official macro calendar in UK time", () => {
  assert.match(client, /TODAY · UK TIME/);
  assert.match(client, /OFFICIAL US MACRO SCHEDULE/);
  assert.match(client, /Europe\/London/);
  assert.match(client, /No BLS, BEA or Federal Reserve release is listed for today/);
  assert.match(client, /NEXT HIGH IMPACT/);
  assert.match(client, /macroContext\?: VerifiedMacroContext/);
});
