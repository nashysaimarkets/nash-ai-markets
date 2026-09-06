import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { POCKET_ANALYSIS_CLIENT_TIMEOUT_MS } from "../app/pocket/analysis-request.ts";

test("analyse gives a four-chart report a bounded long-running window", async () => {
  const source = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  assert.match(source, /const providerDeadlineAt = routeStartedAt \+ POCKET_PROVIDER_DEADLINE_MS/);
  const number = (name: string) => Number(source.match(new RegExp(`const ${name} = ([\\d_]+)`))?.[1].replaceAll("_", ""));
  const report = number("POCKET_ANALYSIS_TIMEOUT_MS");
  const precision = number("POCKET_PRECISION_DEADLINE_MS");
  const provider = number("POCKET_PROVIDER_DEADLINE_MS");
  const platform = number("maxDuration") * 1000;
  assert.ok(report > 165_000, "the expanded report must not retain the failing deadline");
  assert.ok(precision - report >= 40_000, "leave time for independent precision after a slow report");
  assert.ok(provider > precision && platform > provider, "serialize before the platform deadline");
  assert.ok(POCKET_ANALYSIS_CLIENT_TIMEOUT_MS > platform, "the phone must wait for the server outcome");
  assert.match(source, /const precisionDeadlineAt = routeStartedAt \+ POCKET_PRECISION_DEADLINE_MS/);
  assert.match(source, /getVerifiedMacroContext\(\{ route: "\/api\/pocket\/analyse", signal: providerSignal \}\)/);
  assert.match(source, /timeout: Math\.min\(POCKET_ANALYSIS_TIMEOUT_MS, reportTimeoutMs\)/);
  assert.match(source, /const precisionCallBudget:[\s\S]*?deadlineAt: precisionDeadlineAt,[\s\S]*?signal: precisionSignal/);
  assert.match(source, /\}, \{ signal: precisionSignal, timeout: Math\.min\(POCKET_ANALYSIS_TIMEOUT_MS, timeoutMs\) \}\)/);
});

test("report runs alone before optional precision and failures drain all work", async () => {
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
  assert.ok(incompleteReportGuard >= 0 && incompleteReportGuard < precisionStart, "an incomplete report must fail before precision starts");
  assert.match(source, /incompleteReason,[\s\S]*?outputChars:[\s\S]*?outputTokens:[\s\S]*?reasoningTokens/);
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
