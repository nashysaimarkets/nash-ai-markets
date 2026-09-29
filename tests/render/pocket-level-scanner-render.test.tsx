import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import InteractiveLevelScanner from "../../app/pocket/InteractiveLevelScanner";
import { createSampleCharts } from "../../app/pocket/sample-analysis";

const analysis = createSampleCharts()[0].report!;

test("scanner renders readable level controls and honest snapshot context", () => {
  const html = renderToStaticMarkup(<InteractiveLevelScanner analysis={analysis}/>);
  assert.match(html, /Tap a level to explore/);
  assert.match(html, /aria-label="support /);
  assert.match(html, /aria-label="resistance /);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-controls=/);
  assert.match(html, /Snapshot · not a live feed/);
  assert.doesNotMatch(html, /YOU ARE HERE|SCREENSHOT PRECISION|psBattleLevel/);
});

test("each scenario presents its own supplied condition without manufacturing prices", () => {
  const supplied = { ...analysis, bullConfirmation: "UP condition from this chart", bearConfirmation: "DOWN condition from this chart", nextSequence: { ...analysis.nextSequence, patience: "WAIT condition from this chart" } };
  for (const [scenario, condition] of [["bull", "UP"], ["bear", "DOWN"], ["wait", "WAIT"]] as const) {
    const html = renderToStaticMarkup(<InteractiveLevelScanner analysis={supplied} scenario={scenario}/>);
    assert.match(html, new RegExp(`${condition} condition from this chart`));
    assert.match(html, /Conditions to check · not a price forecast/);
    assert.equal((html.match(/condition from this chart/g) ?? []).length, 1);
  }
});

test("missing evidence withholds the scanner and one-sided evidence is explicit", () => {
  const hold = renderToStaticMarkup(<InteractiveLevelScanner analysis={{ ...analysis, levels: [] }} hasContext/>);
  assert.match(hold, /VIEW BOTH SOURCE CHARTS/);
  assert.doesNotMatch(hold, /psScannerStage/);
  const partial = renderToStaticMarkup(<InteractiveLevelScanner analysis={{ ...analysis, levels: analysis.levels.filter((level) => level.kind === "support") }}/>);
  assert.match(partial, /data-structure="partial"/);
  assert.match(partial, /Resistance not verified/);
  assert.doesNotMatch(partial, /aria-label="resistance /);
});
