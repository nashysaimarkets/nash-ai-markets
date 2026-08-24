import test from "node:test";
import assert from "node:assert/strict";
import { preflightAllowsAnalysis } from "../app/pocket/chart-preflight.ts";

test("preflight blocks only active checks and genuinely unusable charts", () => {
  assert.equal(preflightAllowsAnalysis("CHECKING"), false);
  assert.equal(preflightAllowsAnalysis("RETAKE"), false);
  assert.equal(preflightAllowsAnalysis("READY"), true);
  assert.equal(preflightAllowsAnalysis("LIMITED"), true);
  assert.equal(preflightAllowsAnalysis("UNAVAILABLE"), true);
});
