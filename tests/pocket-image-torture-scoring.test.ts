import assert from "node:assert/strict";
import test from "node:test";
import { scoreTortureAnalysis, TORTURE_CASES, type TortureCase } from "./support/pocket-image-torture.ts";

const range = TORTURE_CASES[0]!;
const perfect = {
  levels: [{kind:"resistance",y:31},{kind:"support",y:64}],
  patterns: [{name:"RECTANGLE / RANGE"}],
  liquidity: {state:"VERIFIED",zones:[{}]},
};

test("torture scoring counts duplicate levels and patterns as false positives", () => {
  const scored = scoreTortureAnalysis(range, {...perfect,
    levels: [...perfect.levels, perfect.levels[0]!], patterns: [...perfect.patterns, perfect.patterns[0]!],
  });
  assert.deepEqual(scored.metrics.levels, {tp:2,fp:1,fn:0});
  assert.deepEqual(scored.metrics.patterns, {tp:1,fp:1,fn:0});
  assert.ok(scored.failures.length >= 2);
});

test("one observed level cannot satisfy two expected levels", () => {
  const sample: TortureCase = {...range, expectedLevels:[
    {kind:"support",y:60,tolerance:5},{kind:"support",y:64,tolerance:5},
  ]};
  assert.deepEqual(scoreTortureAnalysis(sample, {...perfect,levels:[{kind:"support",y:62}]}).metrics.levels,
    {tp:1,fp:0,fn:1});
});

test("level assignment finds maximum one-to-one matches rather than a greedy miss", () => {
  const sample: TortureCase = {...range, expectedLevels:[
    {kind:"support",y:60,tolerance:5},{kind:"support",y:64,tolerance:1},
  ]};
  assert.deepEqual(scoreTortureAnalysis(sample, {...perfect,levels:[{kind:"support",y:64},{kind:"support",y:56}]}).metrics.levels,
    {tp:2,fp:0,fn:0});
});

test("liquidity cannot earn a true positive with wrong verification state or absent zones", () => {
  for (const liquidity of [{state:"PARTIAL",zones:[{}]}, {state:"VERIFIED",zones:[]}]) {
    const scored = scoreTortureAnalysis(range, {...perfect,liquidity});
    assert.deepEqual(scored.metrics.liquidity, {tp:0,fp:1,fn:1});
    assert.ok(scored.failures.length > 0);
  }
});

test("wrong sweep event counts as an incorrect detection and a missed expected event", () => {
  const sweep = TORTURE_CASES.find(sample => sample.id === "sweep-reclaim")!;
  const scored = scoreTortureAnalysis(sweep, {liquidity:{state:"VERIFIED",event:"REJECTION",zones:[{}]}});
  assert.deepEqual(scored.metrics.liquidity, {tp:0,fp:1,fn:1});
});

test("perfect and no-signal fixtures score without manufacturing true positives", () => {
  const scored = scoreTortureAnalysis(range, perfect);
  assert.deepEqual(scored.metrics.liquidity, {tp:1,fp:0,fn:0});
  assert.deepEqual(scored.failures, []);
  const negative = TORTURE_CASES.find(sample => sample.id === "near-miss-chop")!;
  const empty = scoreTortureAnalysis(negative, {levels:[],patterns:[],liquidity:{state:"NONE",zones:[]}});
  for (const counts of Object.values(empty.metrics)) assert.deepEqual(counts, {tp:0,fp:0,fn:0});
  assert.deepEqual(empty.failures, []);
});
