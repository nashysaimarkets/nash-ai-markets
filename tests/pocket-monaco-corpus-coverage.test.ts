import assert from "node:assert/strict";
import test from "node:test";
import { checkMonacoCorpusCoverage, MONACO_REQUIRED_SCENARIOS } from "../scripts/pocket-monaco-corpus-coverage.ts";

// Synthetic metadata for contract tests only: no image, market price or licence evidence.
const sample = (case_id: string, scenario: string, timeframe: string, index: number) => ({
  case_id, scenario, timeframe,
  input_sha256: index.toString(16).padStart(64, "0"),
  original_png_sha256: (index + 100).toString(16).padStart(64, "0"),
});
const pack = (cases: ReturnType<typeof sample>[]) => ({ case_count: cases.length, actual_provider_scans: 0, cases });
const canonical = () => MONACO_REQUIRED_SCENARIOS.map((item, index) => sample(`required-${index}`, item.scenario, item.timeframe ?? "30m", index + 1));
const recoveredLabels = () => pack([
  sample("range-clear-01", "range-clear", "30m", 1),
  sample("double-top-01", "double-top", "1h", 2),
  sample("head-shoulders-01", "head-shoulders", "4h", 3),
  sample("sweep-reclaim-01", "sweep-reclaim", "5m", 4),
  sample("near-miss-chop-01", "near-miss-chop", "30m", 5),
  sample("degraded-no-signal-01", "degraded-no-signal", "30m", 6),
]);

test("six recovered input labels are not six canonical owner-required scenarios", () => {
  const result = checkMonacoCorpusCoverage(recoveredLabels());
  assert.equal(result.suppliedCaseCount, 6);
  assert.equal(result.presentCanonicalCaseCount, 3);
  assert.equal(result.coverageStatus, "INCOMPLETE");
  assert.deepEqual(result.missingCanonicalCases.map(item => item.key), ["bear-flag-5m", "wedge-15m", "negative-no-signal"]);
  assert.deepEqual(result.negativeVariantCandidates.map(item => item.caseId), ["near-miss-chop-01", "degraded-no-signal-01"]);
  assert.deepEqual(result.unmatchedCaseIds, ["sweep-reclaim-01", "near-miss-chop-01", "degraded-no-signal-01"]);
  assert.equal(result.dispatchAuthorised, false);
});

test("complete canonical labels pass metadata coverage while all real evidence gates stay blocked", () => {
  const result = checkMonacoCorpusCoverage(pack(canonical()));
  assert.equal(result.coverageStatus, "COMPLETE_AS_DECLARED");
  assert.equal(result.presentCanonicalCaseCount, 6);
  assert.deepEqual(result.missingCanonicalCases, []);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.dispatchAuthorised, false);
  assert.equal(result.inputIntegrity, "NOT_CHECKED_BY_THIS_METADATA_AUDIT");
  assert.equal(result.provider.verifiedMeasurements, 0);
  for (const code of ["SOURCE_AND_FEED_RIGHTS_EVIDENCE_REQUIRED", "SECOND_INDEPENDENT_ANNOTATION_REQUIRED", "PROVIDER_EXECUTOR_FINANCE_AND_MEASUREMENT_GATES_REQUIRED"]) assert.ok(result.dependencies.some(item => item.code === code));
});

test("right pattern on wrong timeframe never satisfies its required case", () => {
  for (const index of [0, 1, 2, 3, 4]) {
    const cases = canonical(); cases[index].timeframe = "2h";
    const result = checkMonacoCorpusCoverage(pack(cases));
    assert.equal(result.presentCanonicalCaseCount, 5);
    assert.equal(result.missingCanonicalCases[0]?.key, MONACO_REQUIRED_SCENARIOS[index].key);
  }
});

test("duplicated identities or image hashes cannot inflate the canonical count", () => {
  for (const field of ["case_id", "input_sha256", "original_png_sha256"] as const) {
    const cases = canonical(); cases[3][field] = cases[4][field];
    const result = checkMonacoCorpusCoverage(pack(cases));
    assert.equal(result.coverageStatus, "INVALID");
    assert.equal(result.presentCanonicalCaseCount, 4);
    assert.equal(result.dispatchAuthorised, false);
  }
});

test("multiple undeclared choices for one canonical scenario require explicit selection", () => {
  const cases = canonical(); cases.push(sample("second-wedge", "wedge", "15m", 20));
  const result = checkMonacoCorpusCoverage(pack(cases));
  assert.equal(result.coverage.find(item => item.key === "wedge-15m")?.status, "AMBIGUOUS");
  assert.equal(result.presentCanonicalCaseCount, 5);
});

test("malformed manifest, counts, source identities and hashes fail closed without throwing", () => {
  for (const bad of [null, [], {}, { case_count: 0, cases: null }, { ...pack(canonical()), case_count: 99 }, { ...pack(canonical()), actual_provider_scans: -1 }]) {
    const result = checkMonacoCorpusCoverage(bad);
    assert.equal(result.coverageStatus, "INVALID");
    assert.equal(result.dispatchAuthorised, false);
  }
  for (const bad of [null, { ...canonical()[0], input_sha256: "not-a-hash" }, { ...canonical()[0], scenario: "bear flag" }, { ...canonical()[0], timeframe: "UNKNOWN" }]) {
    const result = checkMonacoCorpusCoverage({ case_count: 1, actual_provider_scans: 0, cases: [bad] });
    assert.equal(result.presentCanonicalCaseCount, 0);
    assert.equal(result.coverageStatus, "INVALID");
  }
});

test("self-declared rights, review and provider counts cannot become verified evidence", () => {
  const raw = { ...pack(canonical()), actual_provider_scans: 6, licence: "fully licensed", second_annotation: "approved", receipts: "settled" };
  const before = JSON.stringify(raw);
  const result = checkMonacoCorpusCoverage(raw);
  assert.equal(result.provider.claimedScans, 6);
  assert.equal(result.provider.verifiedMeasurements, 0);
  assert.equal(result.provider.accuracy, "UNMEASURED");
  assert.equal(result.dispatchAuthorised, false);
  assert.ok(result.dependencies.some(item => item.code === "SOURCE_AND_FEED_RIGHTS_EVIDENCE_REQUIRED"));
  assert.ok(result.dependencies.some(item => item.code === "SECOND_INDEPENDENT_ANNOTATION_REQUIRED"));
  assert.equal(JSON.stringify(raw), before, "the audit never rewrites fixture metadata");
});
