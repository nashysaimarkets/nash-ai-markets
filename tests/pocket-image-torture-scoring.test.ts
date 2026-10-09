import assert from "node:assert/strict";
import test from "node:test";
import { scoreTortureAnalysis, summarizeTortureMeasurements, aggregateSeparateTortureReports, TORTURE_CASES, type TortureCase } from "./support/pocket-image-torture.ts";

const range = TORTURE_CASES[0]!;
const perfect = {
  levels: [{kind:"resistance",y:31},{kind:"support",y:64}],
  patterns: [{name:"RECTANGLE / RANGE",geometry:{points:[{x:20,y:31},{x:50,y:64},{x:80,y:31}]}}],
  liquidity: {state:"VERIFIED",zones:[{side:"BUY_SIDE",basis:"RANGE_HIGH",x:20,x2:80,y:31}]},
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
  const scored = scoreTortureAnalysis(sweep, {levels:[],patterns:[],liquidity:{state:"VERIFIED",event:"REJECTION",zones:[{}]}});
  assert.deepEqual(scored.metrics.liquidity, {tp:0,fp:1,fn:1});
});

test("no-signal cases cannot pass with omitted null or malformed scanner output", () => {
  const negative = TORTURE_CASES.find(sample => sample.id === "near-miss-chop")!;
  const empty = { levels: [], patterns: [], liquidity: { state: "NONE", zones: [] } };
  for (const body of [
    {}, { ...empty, levels: undefined }, { ...empty, patterns: undefined }, { ...empty, liquidity: undefined },
    { ...empty, levels: null }, { ...empty, patterns: null }, { ...empty, liquidity: null },
    { ...empty, levels: [null] }, { ...empty, patterns: [null] },
    { ...empty, liquidity: { state: "UNKNOWN", zones: [] } },
    { ...empty, liquidity: { state: "NONE" } }, { ...empty, liquidity: { state: "NONE", zones: [{}] } },
  ]) assert.throws(() => scoreTortureAnalysis(negative, body as Parameters<typeof scoreTortureAnalysis>[1]), /scanner output/i);
});

test("matching names and placeholder zones cannot earn geometry-free true positives", () => {
  const scored = scoreTortureAnalysis(range, {...perfect,
    patterns:[{name:"RECTANGLE / RANGE"}], liquidity:{state:"VERIFIED",zones:[{}]},
  });
  assert.deepEqual(scored.metrics.patterns, {tp:0,fp:1,fn:1});
  assert.deepEqual(scored.metrics.liquidity, {tp:0,fp:1,fn:1});
  const bad = scoreTortureAnalysis(range, {...perfect,
    patterns:[{name:"RECTANGLE / RANGE",geometry:{points:[{x:20,y:31},{x:80,y:64},{x:80,y:64}]}}],
    liquidity:{state:"VERIFIED",zones:[{side:"BUY_SIDE",basis:"RANGE_HIGH",x:20,x2:80,y:101}]},
  } as Parameters<typeof scoreTortureAnalysis>[1]);
  assert.deepEqual(bad.metrics.patterns, {tp:0,fp:1,fn:1});
  assert.deepEqual(bad.metrics.liquidity, {tp:0,fp:1,fn:1});
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

test("incomplete image runs cannot report aggregate benchmark precision or recall", () => {
  const counts = scoreTortureAnalysis(range,perfect).metrics;
  const result = summarizeTortureMeasurements(TORTURE_CASES.map(sample=>sample.id),[range.id],counts);
  assert.equal(result.measurementComplete,false);
  assert.equal(result.measuredCases,1);
  assert.equal(result.unmeasuredCaseIds.length,5);
  for (const metric of Object.values(result.metrics)) {
    assert.equal(metric.precision,null);
    assert.equal(metric.recall,null);
  }
});

test("complete measurements retain actual rates and undefined denominators", () => {
  const counts = {levels:{tp:2,fp:1,fn:2},patterns:{tp:0,fp:0,fn:0},liquidity:{tp:1,fp:1,fn:0}};
  const result = summarizeTortureMeasurements(["a","b"],["a","b"],counts);
  assert.equal(result.measurementComplete,true);
  assert.equal(result.metrics.levels.precision,2/3);
  assert.equal(result.metrics.levels.recall,0.5);
  assert.equal(result.metrics.patterns.precision,null);
  assert.equal(result.metrics.patterns.recall,null);
});

test("unknown or duplicate measured image IDs cannot manufacture completion", () => {
  const counts = scoreTortureAnalysis(range,perfect).metrics;
  assert.throws(()=>summarizeTortureMeasurements(["a","b"],["a","a"],counts),/measurement IDs/);
  assert.throws(()=>summarizeTortureMeasurements(["a","b"],["a","c"],counts),/measurement IDs/);
});

test("separate paid scans cannot claim completeness until all six are measured", () => {
  const cases = TORTURE_CASES.map(sample => sample.id);
  const reports = TORTURE_CASES.map(sample => ({
    cases:1, observations:[{id:sample.id,caseMetrics:{
      levels:{tp:sample.expectedLevels.length,fp:0,fn:0},
      patterns:{tp:sample.expectedPatterns.length,fp:0,fn:0},
      liquidity:{tp:sample.expectedLiquidity.state === "NONE" ? 0 : 1,fp:0,fn:0},
    }}],
  }));
  const partial = aggregateSeparateTortureReports(reports.slice(0,1));
  assert.equal(partial.measurementComplete,false);
  assert.equal(partial.measuredCases,1);
  assert.equal(partial.unmeasuredCaseIds.length,5);
  for (const metric of Object.values(partial.metrics)) {
    assert.equal(metric.precision,null);
    assert.equal(metric.recall,null);
  }
  const complete = aggregateSeparateTortureReports(reports);
  assert.equal(complete.measurementComplete,true);
  assert.equal(complete.measuredCases,6);
  assert.deepEqual(complete.unmeasuredCaseIds,[]);
  assert.equal(complete.metrics.levels.tp,4);
  assert.equal(complete.metrics.levels.precision,1);
});

test("aggregator treats failed scans without scored observations as unmeasured", () => {
  const reports = [{cases:1,observations:[{id:TORTURE_CASES[0]!.id,httpStatus:503}]}];
  const result = aggregateSeparateTortureReports(reports);
  assert.equal(result.measuredCases,0);
  assert.equal(result.measurementComplete,false);
  assert.equal(result.metrics.levels.precision,null);
});

test("aggregator rejects duplicates, unknown cases and invalid or invented counts", () => {
  const good = {levels:{tp:2,fp:0,fn:0},patterns:{tp:1,fp:0,fn:0},liquidity:{tp:1,fp:0,fn:0}};
  const first = {cases:1,observations:[{id:TORTURE_CASES[0]!.id,caseMetrics:good}]};
  assert.throws(() => aggregateSeparateTortureReports([first,first]), /duplicate/i);
  assert.throws(() => aggregateSeparateTortureReports([{cases:1,observations:[{id:"not-labelled",caseMetrics:good}]}]), /unknown/i);
  assert.throws(() => aggregateSeparateTortureReports([{cases:1,observations:[{id:TORTURE_CASES[0]!.id,caseMetrics:{...good,levels:{tp:-1,fp:0,fn:0}}}]}]), /invalid/i);
  assert.throws(() => aggregateSeparateTortureReports([{cases:6,observations:[{id:TORTURE_CASES[0]!.id,caseMetrics:good}]}]), /single-case/i);
});

test("aggregator refuses impossible true positives and omitted false negatives", () => {
  const negative = TORTURE_CASES.find(sample => sample.id === "near-miss-chop")!;
  const range = TORTURE_CASES.find(sample => sample.id === "range-clear")!;
  const empty = {tp:0,fp:0,fn:0};
  const badNegative = {cases:1,observations:[{id:negative.id,caseMetrics:{
    levels:{tp:1,fp:0,fn:0},patterns:empty,liquidity:empty,
  }}]};
  assert.throws(() => aggregateSeparateTortureReports([badNegative]), /invalid|impossible/i);
  const missedRange = {cases:1,observations:[{id:range.id,caseMetrics:{
    levels:{tp:1,fp:0,fn:0},patterns:{tp:0,fp:0,fn:1},liquidity:{tp:0,fp:0,fn:1},
  }}]};
  assert.throws(() => aggregateSeparateTortureReports([missedRange]), /invalid|impossible/i);
  const impossibleFalsePositives = {cases:1,observations:[{id:negative.id,caseMetrics:{
    levels:{tp:0,fp:1000,fn:0},patterns:empty,liquidity:empty,
  }}]};
  assert.throws(() => aggregateSeparateTortureReports([impossibleFalsePositives]), /invalid|impossible/i);
});
