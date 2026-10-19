/** Offline metadata audit only. Does not read files, verify hashes or authorise dispatch. */
export const MONACO_REQUIRED_SCENARIOS = Object.freeze([
  { key: "range-clear-30m", scenario: "range-clear", timeframe: "30m" },
  { key: "double-top-1h", scenario: "double-top", timeframe: "1h" },
  { key: "head-shoulders-4h", scenario: "head-shoulders", timeframe: "4h" },
  { key: "bear-flag-5m", scenario: "bear-flag", timeframe: "5m" },
  { key: "wedge-15m", scenario: "wedge", timeframe: "15m" },
  { key: "negative-no-signal", scenario: "negative-no-signal", timeframe: null },
] as const);

type Case = { case_id: string; scenario: string; timeframe: string; input_sha256: string; original_png_sha256: string };
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(value);
const sha256 = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

/**
 * Exact declared scenario/timeframe coverage, kept separate from evidence quality.
 * Degraded/noise variants are review candidates, never silently relabelled.
 * Rights/annotation assertions require independent external review: even an input
 * field claiming "licensed" or "reviewed" is not a proof accepted by this checker.
 */
export function checkMonacoCorpusCoverage(value: unknown) {
  const manifest = record(value);
  const issues: string[] = [];
  const rawCases = manifest && Array.isArray(manifest.cases) ? manifest.cases : [];
  if (!manifest || !Array.isArray(manifest.cases)) issues.push("INVALID_CASE_LIST");
  if (!manifest || !Number.isSafeInteger(manifest.case_count) || manifest.case_count !== rawCases.length) issues.push("CASE_COUNT_MISMATCH");
  const parsed: Case[] = [];
  rawCases.forEach((raw, index) => {
    const item = record(raw);
    if (!item || !identifier(item.case_id) || !identifier(item.scenario) || typeof item.timeframe !== "string" ||
        !/^[1-9]\d{0,2}[mhdw]$/.test(item.timeframe) || !sha256(item.input_sha256) || !sha256(item.original_png_sha256)) {
      issues.push(`INVALID_CASE_METADATA:${index}`);
      return;
    }
    parsed.push({ case_id: item.case_id, scenario: item.scenario, timeframe: item.timeframe, input_sha256: item.input_sha256, original_png_sha256: item.original_png_sha256 });
  });
  const duplicateIds = new Set(parsed.filter((item, index) => parsed.findIndex(other => other.case_id === item.case_id) !== index).map(item => item.case_id));
  const duplicateInputs = new Set(parsed.filter((item, index) => parsed.findIndex(other => other.input_sha256 === item.input_sha256) !== index).map(item => item.input_sha256));
  const duplicateOriginals = new Set(parsed.filter((item, index) => parsed.findIndex(other => other.original_png_sha256 === item.original_png_sha256) !== index).map(item => item.original_png_sha256));
  if (duplicateIds.size) issues.push("DUPLICATE_CASE_ID");
  if (duplicateInputs.size || duplicateOriginals.size) issues.push("DUPLICATE_CASE_CONTENT_IDENTITY");
  const eligible = parsed.filter(item => !duplicateIds.has(item.case_id) && !duplicateInputs.has(item.input_sha256) && !duplicateOriginals.has(item.original_png_sha256));
  const coverage = MONACO_REQUIRED_SCENARIOS.map(required => {
    const matches = eligible.filter(item => item.scenario === required.scenario && (required.timeframe === null || item.timeframe === required.timeframe));
    return {
      ...required,
      status: matches.length === 1 ? "PRESENT_AS_DECLARED" as const : matches.length > 1 ? "AMBIGUOUS" as const : "MISSING" as const,
      caseIds: matches.map(item => item.case_id),
    };
  });
  const negativeVariants = eligible.filter(item => ["degraded-no-signal", "near-miss-chop"].includes(item.scenario)).map(item => ({
    caseId: item.case_id, declaredScenario: item.scenario, timeframe: item.timeframe,
    candidateFor: "negative-no-signal", status: "INDEPENDENT_SEMANTIC_REVIEW_REQUIRED" as const,
  }));
  const present = coverage.filter(item => item.status === "PRESENT_AS_DECLARED");
  const claimedProviderScans = manifest && Number.isSafeInteger(manifest.actual_provider_scans) && Number(manifest.actual_provider_scans) >= 0
    ? Number(manifest.actual_provider_scans) : null;
  if (claimedProviderScans === null) issues.push("INVALID_PROVIDER_CALL_COUNT");
  const caseIds = parsed.map(item => item.case_id);
  return {
    purpose: "OFFLINE_CONTRACT_COVERAGE_ONLY" as const,
    status: "BLOCKED" as const,
    dispatchAuthorised: false as const,
    coverageStatus: issues.length ? "INVALID" as const : present.length === MONACO_REQUIRED_SCENARIOS.length ? "COMPLETE_AS_DECLARED" as const : "INCOMPLETE" as const,
    requiredCaseCount: MONACO_REQUIRED_SCENARIOS.length,
    suppliedCaseCount: rawCases.length,
    presentCanonicalCaseCount: present.length,
    coverage,
    missingCanonicalCases: coverage.filter(item => item.status !== "PRESENT_AS_DECLARED").map(({ key, scenario, timeframe, status }) => ({ key, scenario, timeframe, status })),
    unmatchedCaseIds: eligible.filter(item => !present.some(row => row.caseIds.includes(item.case_id))).map(item => item.case_id),
    negativeVariantCandidates: negativeVariants,
    issues,
    inputIntegrity: "NOT_CHECKED_BY_THIS_METADATA_AUDIT" as const,
    provider: { claimedScans: claimedProviderScans, verifiedMeasurements: 0, accuracy: "UNMEASURED" as const, receipts: "NOT_EVALUATED" as const },
    dependencies: [
      { code: "CANONICAL_SCENARIOS_AND_TIMEFRAMES_REQUIRED", owner: "Scanner engineer / independent annotator", caseIds: coverage.filter(item => item.status !== "PRESENT_AS_DECLARED").map(item => item.key) },
      { code: "SOURCE_AND_FEED_RIGHTS_EVIDENCE_REQUIRED", owner: "Owner / source licensor", caseIds },
      { code: "SECOND_INDEPENDENT_ANNOTATION_REQUIRED", owner: "Independent chart annotator", caseIds },
      { code: "PROVIDER_EXECUTOR_FINANCE_AND_MEASUREMENT_GATES_REQUIRED", owner: "Release security reviewer / authorised executor", caseIds: MONACO_REQUIRED_SCENARIOS.map(item => item.key) },
    ].filter(item => item.caseIds.length),
  };
}
