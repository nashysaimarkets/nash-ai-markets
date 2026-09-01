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
  assert.match(client, /postLevelLabScan/);
  assert.match(client, /createLevelLabScanImage/);
  assert.match(client, /JSON\.stringify\(\{ image: scanImage, primaryProvenance \}\)/);
  const merge = client.slice(client.indexOf("async function rescanLevelsOnly"), client.indexOf("async function reanalyseResult"));
  assert.doesNotMatch(merge, /requireAppleEntitlementForAdditionalRequest/);
});

test("Level Lab merges only price-map fields into the existing analysis", () => {
  const merge = client.slice(client.indexOf("async function rescanLevelsOnly"), client.indexOf("async function reanalyseResult"));
  assert.match(merge, /setAnalysis\(\(current\)/);
  for (const protectedField of ["verdict:", "patterns:", "setupScore:", "nextSequence:", "riskFlags:"]) assert.doesNotMatch(merge, new RegExp(protectedField));
  assert.doesNotMatch(merge, /liquidityShield:/);
  assert.match(merge, /primaryProvenance/);
  assert.doesNotMatch(merge, /plotBounds: analysis\.plotBounds/);
  assert.doesNotMatch(merge, /priceScaleAnchors: analysis\.priceScaleAnchors/);
  assert.match(merge, /hasVerifiedTwoSidedStructure/);
  assert.match(merge, /provenance\?\.source === "LEVEL_LAB"/);
  assert.match(merge, /returnedTwoSided && returnedTrustGate\.status === "LOCKED"/);
  assert.match(merge, /!returnedTwoSided && returnedTrustGate\.status === "PARTIAL"/);
  assert.match(merge, /returnedTrustGate\.scaleLocked === true/);
  assert.match(merge, /stillBoundToPrimary/);
  assert.match(merge, /current\.instrument === primaryProvenance\.instrument/);
  assert.match(merge, /currentPrice: current\.currentPrice/);
  assert.match(merge, /trustGate: returnedTrustGate/);
  assert.match(merge, /x: Number\.NaN/);
  assert.doesNotMatch(merge, /plotBounds: payload\.levels/);
  assert.doesNotMatch(merge, /priceScaleAnchors: payload\.levels/);
  assert.doesNotMatch(merge, /payload\.levels!\.currentPrice \|\| current\.currentPrice/);
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
  assert.match(client, /enforcePocketTrustGate\([\s\S]*returnedTrustGate/);
  assert.match(client, /confidence, score and verdict are reduced safely/);
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
  assert.match(client, /No scheduled BLS, BEA or Federal Reserve release was returned for today/);
});
