import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pocketAnalysisPolicy } from "../app/pocket/analysis-policy.ts";

test("analyse gives a four-chart report a bounded long-running window", async () => {
  const source = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  const policy = pocketAnalysisPolicy({ image: true, contextImage: true, detailImage: true, fourHourImage: true });
  assert.ok(policy.reportTimeoutMs > 165_000, "keep the proven multi-chart report window");
  assert.ok(policy.precisionDeadlineMs - policy.reportTimeoutMs >= 40_000);
  assert.ok(policy.providerDeadlineMs > policy.precisionDeadlineMs);
  assert.ok(policy.clientTimeoutMs > 300_000);
  assert.match(source, /const providerDeadlineAt = routeStartedAt \+ policy.providerDeadlineMs/);
  assert.match(source, /const precisionDeadlineAt = routeStartedAt \+ policy.precisionDeadlineMs/);
  assert.match(source, /timeout: Math\.min\(policy.reportTimeoutMs, reportTimeoutMs\)/);
  assert.match(source, /const precisionCallBudget:[\s\S]*?deadlineAt: precisionDeadlineAt,[\s\S]*?signal: precisionSignal/);
  assert.match(source, /\}, \{ signal: precisionSignal, timeout: Math\.min\(policy.precisionCallTimeoutMs, timeoutMs\) \}\)/);
});

test("multi-chart reports run alone; single-chart precision overlaps; failures drain all work", async () => {
  const source = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  const reportFailureAbort = source.indexOf("providerAbortController.abort(error);", source.indexOf("const analysisRequest"));
  const precisionStart = source.indexOf("const precisionWork");
  const rescueGate = source.indexOf("await analysisRequest;", precisionStart);
  const primaryStart = source.indexOf('firstPrecision(image, "primary"', precisionStart);
  const contextStart = source.indexOf('firstPrecision(contextImage, "context")', precisionStart);
  const firstRescue = source.indexOf("finishPrecision(primaryFirst", precisionStart);
  const drain = source.indexOf("await Promise.allSettled([analysisRequest, precisionWork])");
  assert.ok(reportFailureAbort >= 0 && reportFailureAbort < precisionStart);
  const incompleteReportGuard = source.indexOf("completedPocketReportOutput(response)", source.indexOf("const analysisRequest"));
  assert.ok(incompleteReportGuard >= 0 && incompleteReportGuard < precisionStart, "an incomplete report must fail instead of returning partial analysis");
  assert.match(source, /incompleteReason,[\s\S]*?outputChars:[\s\S]*?outputTokens:[\s\S]*?reasoningTokens/);
  assert.match(source, /if \(!policy.parallelPrecision\) await analysisRequest;/);
  assert.ok(rescueGate > precisionStart && rescueGate < primaryStart);
  assert.ok(primaryStart > rescueGate, "primary precision must not compete with the report");
  assert.ok(contextStart > rescueGate, "context precision must not compete with the report");
  assert.ok(contextStart < firstRescue, "every supplied chart must receive an initial precision pass before a rescue can consume the shared budget");
  assert.ok(drain > precisionStart);
  assert.match(source, /firstFailure: precisionSignal\.aborted \? "REQUEST_ABORTED" : "REQUEST_FAILED"/);
});

test("real-chart precision exhaustion cannot starve context recovery or return an unlabeled incomplete response", async () => {
  const source = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  assert.match(source, /remainingCalls: contextImage \? 4 : 2/);
  assert.match(source, /reasoning: \{ effort: "low" \}/);
  assert.match(source, /max_output_tokens: 5000/);
  assert.match(source, /first\.status !== "completed" \|\| !output/);
  assert.match(source, /rescue\.status !== "completed" \|\| !rescueOutput/);
  assert.match(source, /\$\{label\} precision provider completion/);
  assert.match(source, /phase: "initial"/);
  assert.match(source, /phase: "rescue"/);
  assert.match(source, /const \[primary, context\] = await Promise\.all/);
});

test("analyse bounds the aggregate body before parsing fields or taking provider budget", async () => {
  const source = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  const boundedRead = source.indexOf("readBoundedJsonBody(request, MAX_REQUEST_BYTES)");
  const fieldRead = source.indexOf("payload.image", boundedRead);
  const budget = source.indexOf('takePocketBudget(request, "analyse")', boundedRead);
  assert.ok(boundedRead >= 0 && boundedRead < fieldRead && fieldRead < budget);
  assert.match(source, /error instanceof RequestBodyTooLargeError[\s\S]*?status: 413/);
});
