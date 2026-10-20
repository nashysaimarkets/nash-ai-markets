import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Optional red-run adapter executes the actual two legacy UI statements, not a
// reimplementation of the previous regex. Fixed runs import the shared helper.
const legacyPath = process.env.POCKET_QA_RSI_LEGACY_SOURCE;
const readVisibleRsi: (text: unknown) => number | null = legacyPath
  ? (() => {
    const source = readFileSync(legacyPath, "utf8");
    const block = source.match(/const rsiMatch = analysis\.momentum\.match\([^\n]+\);\s*const rsi = rsiMatch[^\n]+;/)?.[0];
    assert.ok(block, "Actual legacy RSI source must be present for red-run comparison");
    return new Function("momentum", block.replaceAll("analysis.momentum", "momentum") + "return rsi;") as (text: unknown) => number | null;
  })()
  : (await import("../app/pocket/indicator-reading.ts")).readVisibleRsi;

test("explicit visible RSI readings preserve decimals and the full valid range", () => {
  for (const [text, value] of [["RSI: 56.2", 56.2], ["RSI (14): 61.4", 61.4], ["RSI(14) = 0", 0], ["RSI is at 100", 100], ["RSI reads 72.25; MACD is not supplied.", 72.25], ["RSI: 65.", 65], ["RSI: 65, rising momentum.", 65]] as const) {
    assert.equal(readVisibleRsi(text), value, text);
  }
});

test("an RSI period or threshold is never substituted for the current reading", () => {
  for (const text of ["RSI (14) is visible but its value is unreadable.", "RSI14 is overbought.", "RSI 14", "RSI above 70 indicates overbought conditions.", "RSI 70 is a threshold, no current value is shown."]) assert.equal(readVisibleRsi(text), null, text);
});

test("negated or unavailable indicator values remain unreadable", () => {
  for (const text of ["RSI not visible; momentum is 65.", "No RSI: 65 is visible.", "RSI: 65 is unverified.", "RSI is not readable at 65."]) assert.equal(readVisibleRsi(text), null, text);
});

test("out-of-range, negative and malformed readings are rejected rather than clamped", () => {
  for (const text of ["RSI: -5", "RSI: −5", "RSI: 105", "RSI: 1000", "RSI: 60,5", "RSI: 60.4.5", "RSI: 60%", "RSI: 65e2"]) assert.equal(readVisibleRsi(text), null, text);
});

test("estimated, conditional or range readings cannot become a precise indicator", () => {
  for (const text of ["RSI is around 65", "RSI: 65–70", "RSI: 65 to 70", "RSI: 65 +/- 5", "Estimated RSI: 65", "If the rally holds, RSI: 70."]) assert.equal(readVisibleRsi(text), null, text);
});

test("multiple RSI readings have no unambiguous single value", () => {
  assert.equal(readVisibleRsi("RSI: 60; RSI: 45"), null);
  assert.equal(readVisibleRsi("RSI (14): 60 and RSI (28): 45"), null);
});

test("alternative numbers cannot masquerade as one current RSI reading", () => {
  for (const text of ["RSI:65 or35", "RSI:65 or 35", "RSI:65 and35", "RSI:65 and 35", "RSI:65 versus 35", "RSI:65, 35", "RSI:65 &35"]) assert.equal(readVisibleRsi(text), null, text);
});

test("explicit historical readings are held while explicit current values remain available", () => {
  for (const text of ["Previous RSI:65", "Yesterday RSI:65", "Previously RSI:65", "Historical RSI:65", "Earlier RSI:65", "Prior RSI:65", "RSI:65 two hours ago", "RSI:65 at last close"]) assert.equal(readVisibleRsi(text), null, text);
  assert.equal(readVisibleRsi("Current RSI(14):61.4"), 61.4);
  assert.equal(readVisibleRsi("Latest RSI:65"), 65);
  assert.equal(readVisibleRsi("RSI:65; Yesterday price was 100."), 65);
});

test("empty and unsupported input never yields a numeric reading", () => {
  for (const text of ["", "MACD: 65", "No indicators supplied."]) assert.equal(readVisibleRsi(text), null);
  if (!legacyPath) for (const text of [null, undefined, {}, 65, "a".repeat(2049)]) assert.equal(readVisibleRsi(text), null);
});
