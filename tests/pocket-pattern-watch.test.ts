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
  assert.match(client, /PATTERN WATCH/);
  assert.match(client, /30M · 1H · 4H STRUCTURE CHECK/);
  assert.match(client, /NO SIGNIFICANT PATTERN VERIFIED/);
  assert.match(client, /WHAT DOES THIS MEAN/);
  assert.match(client, /useState\(true\)/);
  assert.match(client, /HIDE GALLERY/);
  assert.match(styles, /\.psPatternGuide/);
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
  const route = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  for (const name of ["ASCENDING TRIANGLE", "DESCENDING TRIANGLE", "PENNANT", "CUP & HANDLE", "RECTANGLE / RANGE", "TREND CHANNEL", "BREAKOUT & RETEST"]) {
    assert.match(route, new RegExp(name));
  }
  assert.match(route, /Prefer AMBIGUOUS over forcing a name/);
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
