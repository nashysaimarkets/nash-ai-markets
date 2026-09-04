import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Pattern Watch exposes strict status, timeframe and confirmation evidence", async () => {
  const [route, client, styles] = await Promise.all([
    readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-pattern-watch.css", import.meta.url), "utf8"),
  ]);
  assert.match(route, /timeframe: \{ type: "string"/);
  assert.match(route, /confidence: \{ type: "string", enum: \["LOW", "MEDIUM", "HIGH"\]/);
  assert.match(route, /confirmation: \{ type: "string"/);
  assert.match(route, /geometry: \{/);
  assert.match(route, /points: \{ type: "array", minItems: 2, maxItems: 10/);
  assert.match(route, /return an empty array when none is defensible/);
  assert.match(route, /Test competing explanations before choosing a name/);
  assert.match(route, /triangles need at least two reactions on each boundary/);
  assert.match(route, /independently scan every supplied image/);
  assert.match(route, /single strongest defensible pattern from each supplied image/);
  assert.match(route, /sourceRole/);
  assert.match(route, /geometry\.plotBounds must tightly enclose that source image's candle plot/);
  assert.match(client, /PATTERN WATCH/);
  assert.match(client, /INDEPENDENT TIMEFRAME/);
  assert.match(client, /NO SIGNIFICANT.*PATTERN VERIFIED/);
  assert.match(client, /WHAT DOES THIS MEAN/);
  assert.match(client, /Choose Pattern Watch timeframe/);
  assert.match(client, /Show \$\{frame\.timeframe\} pattern analysis/);
  assert.match(client, /setSelectedRole\(frame\.sourceRole\)/);
  assert.match(client, /visiblePatterns/);
  assert.match(client, /useState\(true\)/);
  assert.match(client, /HIDE GALLERY/);
  assert.match(styles, /\.psPatternGuide/);
  assert.match(styles, /\.psPatternFrames>button\[data-active="true"\]/);
  assert.match(client, /ANALYSED/);
});

test("Pattern Watch applies a deterministic geometry and confidence gate", async () => {
  const calibration = await readFile(new URL("../app/api/pocket/analysis-calibration.ts", import.meta.url), "utf8");
  assert.match(calibration, /PATTERN_MIN_POINTS/);
  assert.match(calibration, /point\.x < points\[index - 1\]/);
  assert.match(calibration, /xSpan < \(right - left\) \* \.12/);
  assert.match(calibration, /status !== "CONFIRMED" && status !== "EXTENDED"/);
  assert.match(calibration, /seenSources\.has\(sourceRole\)/);
});

test("Pattern Watch switches every independently analysed supplied timeframe", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(client, /const PATTERN_FRAMES/);
  assert.match(client, /function normalizePatternFrame/);
  assert.match(client, /function independentTimeframes/);
  assert.match(client, /pattern\.sourceRole === active\?\.sourceRole/);
  assert.match(client, /frames\.map\(\(frame\)/);
  assert.doesNotMatch(client, /timeframeInput\.current\?\.click\(\)/);
});

test("the guide covers reversal, continuation and compression families", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  for (const name of ["HEAD & SHOULDERS", "INVERSE H&S", "RISING WEDGE", "FALLING WEDGE", "BULL FLAG", "BEAR FLAG", "DOUBLE TOP / BOTTOM", "TRIANGLE", "ASCENDING TRIANGLE", "DESCENDING TRIANGLE", "PENNANT", "CUP & HANDLE", "RECTANGLE / RANGE", "TREND CHANNEL", "BREAKOUT & RETEST"]) {
    assert.match(client, new RegExp(name.replace(/[&/]/g, ".")));
  }
  assert.match(client, /A shape is not a signal by itself/);
  assert.match(client, /right\.alias\.length - left\.alias\.length/);
});

test("the scanner is instructed to recognize the expanded guide without forcing a label", async () => {
  const [route, client, xrayStyles, launchStyles] = await Promise.all([
    readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-2.css", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-launch-v16.css", import.meta.url), "utf8"),
  ]);
  for (const name of ["ASCENDING TRIANGLE", "DESCENDING TRIANGLE", "PENNANT", "CUP & HANDLE", "RECTANGLE / RANGE", "TREND CHANNEL", "BREAKOUT & RETEST"]) {
    assert.match(route, new RegExp(name));
  }
  assert.match(route, /Prefer AMBIGUOUS over forcing a name/);
  assert.match(route, /never extend a path into blank future space, invent a projected leg or draw a forecast/);
  assert.match(route, /forming breakout\/retest must remain explicitly unconfirmed/);
  assert.match(client, /VISIBLE HISTORY/);
  assert.match(client, /NOT A FORECAST/);
  assert.match(client, /WAITING FOR HOLD \/ REJECTION/);
  assert.match(client, /The line joins swings already visible on your screenshot/);
  assert.match(xrayStyles, /stroke-width:1\.35;stroke-dasharray:2\.5 2\.5;opacity:\.78/);
  assert.match(launchStyles, /\.psXRayTraceKey/);
});

test("every written-report rail control has a real destination", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  for (const id of ["bullseye-verdict", "bullseye-events", "bullseye-levels", "bullseye-evidence", "bullseye-feedback"]) {
    assert.match(client, new RegExp(`id=["']${id}["']`));
    assert.match(client, new RegExp(`href=["']#${id}["']`));
  }
});

test("trade-intention choices use distinct green red and orange text", async () => {
  const styles = await readFile(new URL("../app/pocket/pocket-consistency.css", import.meta.url), "utf8");
  assert.match(styles, /\.psIntent button:nth-child\(1\).*#62eca6/);
  assert.match(styles, /\.psIntent button:nth-child\(2\).*#ff7180/);
  assert.match(styles, /\.psIntent button:nth-child\(3\).*#f0ad4e/);
});
