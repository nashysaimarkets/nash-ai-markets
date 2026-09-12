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

test("automatic level recovery remains while the duplicate manual scanner is removed", () => {
  assert.doesNotMatch(client, /INDEPENDENT LEVEL LAB/);
  assert.doesNotMatch(client, /RESCAN LEVELS ONLY/);
  assert.doesNotMatch(client, /async function rescanLevelsOnly/);
  assert.doesNotMatch(client, /bullseye-level-lab/);
  assert.match(client, /postLevelLabScan/);
  assert.match(client, /createLevelLabScanImage/);
  assert.match(client, /JSON\.stringify\(\{ image: levelScanImage, primaryProvenance \}\)/);
});

test("automatic level recovery merges only price-map fields into the completed analysis", () => {
  const merge = client.slice(client.indexOf("if (levelRecovery?.response.ok"), client.indexOf("if (liquidityRecovery?.response.ok"));
  assert.match(merge, /completedAnalysis = invalidateDerivedChartEvidence/);
  for (const protectedField of ["verdict:", "patterns:", "setupScore:", "nextSequence:", "riskFlags:"]) assert.doesNotMatch(merge, new RegExp(protectedField));
  assert.doesNotMatch(merge, /liquidityShield:/);
  assert.match(merge, /primaryProvenance/);
  assert.match(merge, /hasVerifiedTwoSidedStructure/);
  assert.match(merge, /provenance\?\.source === "LEVEL_LAB"/);
  assert.match(merge, /returnedTwoSided/);
  assert.match(merge, /recovered\.trustGate\.scaleLocked === true/);
  assert.match(merge, /currentPrice: completedAnalysis\.currentPrice/);
  assert.match(merge, /trustGate: recovered\.trustGate/);
  assert.match(merge, /x: Number\.NaN/);
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
  assert.match(client, /enforcePocketTrustGate\([\s\S]*recovered\.trustGate/);
  assert.match(route, /inFlightLevelLabRequests\.set\(completedKey, providerWork\)/);
  assert.match(route, /rememberCompletedRequest\(completedKey, result\)/);
  assert.match(route, /inFlightLevelLabRequests\.delete\(completedKey\)/);
  assert.match(route, /LEVEL_LAB_REPLAY_MAX_ENTRIES = 64/);
  assert.match(route, /signal: providerController\.signal/);
  assert.doesNotMatch(route, /signal: request\.signal/);
});

test("Pocket shows a same-day sourced macro calendar in UK time", () => {
  assert.match(client, /TODAY · UK TIME/);
  assert.match(client, /US MACRO \+ MARKET CALENDAR/);
  assert.match(client, /Europe\/London/);
  assert.match(client, /No medium or high-impact US release is listed for today/);
  assert.match(client, /NEXT HIGH IMPACT/);
  assert.match(client, /macroContext\?: VerifiedMacroContext/);
});
