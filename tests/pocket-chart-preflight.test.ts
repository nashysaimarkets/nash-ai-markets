import test from "node:test";
import assert from "node:assert/strict";
import { preflightAllowsAnalysis } from "../app/pocket/chart-preflight.ts";

test("preflight waits only while checking, then allows fail-soft analysis", () => {
  assert.equal(preflightAllowsAnalysis("CHECKING"), false);
  assert.equal(preflightAllowsAnalysis("AWAITING_CONFIRMATION"), true);
  assert.equal(preflightAllowsAnalysis("RETAKE"), true);
  assert.equal(preflightAllowsAnalysis("READY"), true);
  assert.equal(preflightAllowsAnalysis("LIMITED"), true);
  assert.equal(preflightAllowsAnalysis("LOCKED"), true);
  assert.equal(preflightAllowsAnalysis("UNAVAILABLE"), true);
});
