import test from "node:test";
import assert from "node:assert/strict";
import { preflightAllowsAnalysis } from "../app/pocket/chart-preflight.ts";

test("preflight requires a confirmation lock before full analysis", () => {
  assert.equal(preflightAllowsAnalysis("CHECKING"), false);
  assert.equal(preflightAllowsAnalysis("AWAITING_CONFIRMATION"), false);
  assert.equal(preflightAllowsAnalysis("RETAKE"), false);
  assert.equal(preflightAllowsAnalysis("READY"), false);
  assert.equal(preflightAllowsAnalysis("LIMITED"), false);
  assert.equal(preflightAllowsAnalysis("LOCKED"), true);
  assert.equal(preflightAllowsAnalysis("UNAVAILABLE"), true);
});
