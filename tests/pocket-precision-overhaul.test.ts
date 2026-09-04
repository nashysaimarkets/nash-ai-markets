import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";

const componentPath = new URL("../app/pocket/PocketBullseye.tsx", import.meta.url);
const pagePath = new URL("../app/pocket/page.tsx", import.meta.url);
const cssPath = new URL("../app/pocket/pocket-precision-overhaul.css", import.meta.url);

test("written results expose a precision-first evidence summary before the verdict", async () => {
  const source = await readFile(componentPath, "utf8");
  const truthStrip = source.indexOf("<ResultTruthStrip analysis={combinedAnalysis} />");
  const verdict = source.indexOf('<header id="bullseye-verdict"');

  assert.ok(truthStrip > 0);
  assert.ok(verdict > truthStrip);
  assert.match(source, /value: priceVerified \? analysis\.currentPrice : "NOT VERIFIED"/);
  assert.match(source, /TWO-SIDED S \/ R/);
  assert.match(source, /Unverified fields are never replaced with estimates/);
  assert.match(source, /data-verified=\{fact\.verified\}/);
});

test("every customer-facing level surface uses the same fail-closed evidence", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /<MarketStory analysis=\{combinedAnalysis\}/);
  assert.match(source, /<ResultCard analysis=\{combinedAnalysis\}/);
  assert.match(source, /<PocketCommandDeck analysis=\{combinedAnalysis\} macroContext=\{activeMacroContext\} primaryLevels=\{analysis\.levels\}/);
  assert.match(source, /serverCombinedBattlefield\?\.levels \?\? \[\]\)\.filter\(\(level\) => level\.source === "CONTEXT"\)/);
  assert.match(source, /const swingLevels = primaryLevels\.filter\(\(item\) => item\.kind === "pivot"[\s\S]*?Number\.isFinite/);
  assert.match(source, /storyHasTwoSidedStructure/);
  assert.match(source, /Two-sided levels remain unverified/);
  assert.match(source, /instrumentConfidence === "HIGH"/);
  assert.match(source, /timeframeConfidence === "HIGH"/);
  assert.match(source, /chartReadability === "CLEAR"/);
  assert.match(source, /analysis\.trustGate\?\.identityLocked \?\? true/);
  assert.match(source, /analysis\.trustGate\?\.chartLocked \?\? true/);
  assert.match(source, /statusRank\[serverStatus\] < statusRank\[derivedStatus\]/);
  assert.match(source, /analysis\.trustGate\?\.status === "LOCKED"/);
});

test("independent instrument disagreement forces an identity hold", async () => {
  const route = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  assert.match(route, /instrumentIdentitiesMatch\(\[calibrated\.instrument, calibrated\.ticker\], verifiedPrecisionInstrument\)/);
  assert.match(route, /precisionIdentityConflict/);
  assert.match(route, /status: "HOLD"/);
  assert.match(route, /identityLocked: false/);
  assert.match(route, /Independent instrument reads conflict/);
});

test("combined levels retain visible chart provenance on the map, cinema and result card", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /const source = numeric\.source \?\? \(primarySource \? "PRIMARY" : "CONTEXT"\)/);
  assert.ok((source.match(/levelEvidenceSourceLabel\(level\.source\)/g) ?? []).length >= 3);
  assert.ok((source.match(/data-source=\{level\.source \?\? "PRIMARY"\}/g) ?? []).length >= 3);
  assert.match(source, /CURRENT · PRIMARY CHART/);
});

test("client edits invalidate stale combined evidence and keep pending context off the map", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /invalidateDerivedChartEvidence\(current, "CONTEXT_REPLACED"\)/);
  assert.ok((source.match(/"PRIMARY_STRUCTURE_CHANGED"/g) ?? []).length >= 2);
  assert.match(source, /disabled=\{!contextBattlefield\}/);
  assert.match(source, /CONTEXT PENDING/);
  assert.ok((source.match(/hasContext=\{Boolean\(contextBattlefield\)\}/g) ?? []).length >= 2);
});

test("mobile report rail reaches every decision-critical section", async () => {
  const source = await readFile(componentPath, "utf8");
  for (const target of ["#bullseye-verdict", "#bullseye-tools", "#bullseye-levels", "#bullseye-events", "#bullseye-evidence", "#bullseye-ask", "#bullseye-feedback"]) {
    assert.ok(source.includes(`href="${target}"`), `missing report destination ${target}`);
  }
  assert.ok(source.indexOf('href="#bullseye-levels"') < source.indexOf('href="#bullseye-events"'));
});

test("precision presentation layer is last and retired concepts no longer ship CSS", async () => {
  const page = await readFile(pagePath, "utf8");
  assert.ok(page.indexOf('import "./pocket-precision-overhaul.css"') > page.indexOf('import "./pocket-liquidity-guard.css"'));
  assert.doesNotMatch(page, /pocket-lock-on\.css|pocket-command-arena\.css|pocket-bubble-lab\.css/);

  for (const file of ["pocket-lock-on.css", "pocket-command-arena.css", "pocket-bubble-lab.css"]) {
    await assert.rejects(access(new URL(`../app/pocket/${file}`, import.meta.url)));
  }
});

test("overhaul preserves readable controls, focus visibility and reduced motion", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /font-size: max\(\.83rem, 13px\)/);
  assert.match(css, /\.psDataNote a \{[\s\S]*?min-height: 44px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
