import test from "node:test";
import assert from "node:assert/strict";
import { buildVerifiedLevels, numericLevelPrice, seedVerificationDrafts, type VerificationDraft } from "../app/pocket/level-verification.ts";

const anchors = [{ price: 7800, y: 20 }, { price: 7500, y: 80 }];

test("parses formatted positive prices and rejects invalid values", () => {
  assert.equal(numericLevelPrice("7,658.25"), 7658.25);
  assert.equal(numericLevelPrice("7 658.25"), 7658.25);
  assert.equal(numericLevelPrice("7’658.25"), 7658.25);
  assert.equal(numericLevelPrice("7658,25"), 7658.25);
  assert.equal(numericLevelPrice("around 7650"), 7650);
  assert.equal(numericLevelPrice("0"), null);
  assert.equal(numericLevelPrice("unknown"), null);
});

test("preserves detected geometry while seeding review rows", () => {
  const drafts = seedVerificationDrafts([{ kind: "support", label: "Shelf", price: "7600", x: 5, y: 60, x2: 90, y2: 60 }]);
  assert.deepEqual(drafts[0].geometry, { x: 5, y: 60, x2: 90, y2: 60 });
});

test("projects support and resistance to different scale-calibrated rows", () => {
  const drafts: VerificationDraft[] = [
    { id: "s", kind: "support", price: "7600", label: "AI", status: "confirmed" },
    { id: "r", kind: "resistance", price: "7750", label: "AI", status: "confirmed" },
  ];
  const levels = buildVerifiedLevels(drafts, "7658", anchors);
  assert.equal(levels[0].kind, "support");
  assert.equal(levels[1].kind, "resistance");
  assert.notEqual(levels[0].y, levels[1].y);
  assert.equal(levels[0].y, 60);
  assert.equal(levels[1].y, 30);
  assert.ok(levels.every((level) => level.y === level.y2));
});

test("corrects a model or user level placed on the wrong side of current price", () => {
  const levels = buildVerifiedLevels([
    { id: "wrong-low", kind: "resistance", price: "7600", label: "AI", status: "review" },
    { id: "wrong-high", kind: "support", price: "7750", label: "AI", status: "review" },
  ], "7658", anchors);
  assert.deepEqual(levels.map((level) => level.kind), ["support", "resistance"]);
});

test("rejects unusable rows and deduplicates near-identical levels", () => {
  const levels = buildVerifiedLevels([
    { id: "one", kind: "support", price: "7600", label: "AI", status: "review" },
    { id: "two", kind: "support", price: "7600.4", label: "USER VERIFIED", status: "confirmed" },
    { id: "bad", kind: "resistance", price: "", label: "AI", status: "review" },
    { id: "rejected", kind: "resistance", price: "7750", label: "AI", status: "rejected" },
  ], "7658", anchors);
  assert.equal(levels.length, 1);
  assert.equal(levels[0].price, "7600.4");
  assert.equal(levels[0].label, "USER VERIFIED");
});

test("falls back to preserved source geometry when no readable scale exists", () => {
  const drafts = seedVerificationDrafts([{ kind: "support", label: "Shelf", price: "7600", x: 7, y: 67, x2: 91, y2: 67 }]);
  const levels = buildVerifiedLevels(drafts, "7658", []);
  assert.deepEqual({ x: levels[0].x, y: levels[0].y, x2: levels[0].x2, y2: levels[0].y2 }, { x: 7, y: 67, x2: 91, y2: 67 });
});

test("rejects inverted or off-canvas anchors and preserves source geometry", () => {
  const drafts = seedVerificationDrafts([{ kind: "support", label: "Shelf", price: "7600", x: 7, y: 67, x2: 91, y2: 67 }]);
  const inverted = buildVerifiedLevels(drafts, "7658", [{ price: 7500, y: 20 }, { price: 7800, y: 80 }]);
  const offCanvas = buildVerifiedLevels(drafts, "7658", [{ price: 7500, y: 140 }, { price: 7800, y: -20 }]);
  assert.equal(inverted[0].y, 67);
  assert.equal(offCanvas[0].y, 67);
});
