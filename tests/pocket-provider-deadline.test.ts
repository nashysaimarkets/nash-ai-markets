import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("analyse gives a four-chart report a bounded long-running window", async () => {
  const source = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  assert.match(source, /const providerDeadlineAt = routeStartedAt \+ POCKET_PROVIDER_DEADLINE_MS/);
  assert.match(source, /const POCKET_ANALYSIS_TIMEOUT_MS = 165_000/);
  assert.match(source, /const POCKET_PROVIDER_DEADLINE_MS = 168_000/);
  assert.match(source, /const POCKET_PRECISION_DEADLINE_MS = 165_000/);
  assert.match(source, /export const maxDuration = 180/);
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
  assert.ok(rescueGate > precisionStart && rescueGate < primaryStart);
  assert.ok(primaryStart > rescueGate, "primary precision must not compete with the report");
  assert.ok(contextStart > rescueGate, "context precision must not compete with the report");
  assert.ok(contextStart < firstRescue, "every supplied chart must receive an initial precision pass before a rescue can consume the shared budget");
  assert.ok(drain > precisionStart);
  assert.match(source, /firstFailure: precisionSignal\.aborted \? "REQUEST_ABORTED" : "REQUEST_FAILED"/);
});

test("analyse bounds the aggregate body before parsing fields or taking provider budget", async () => {
  const source = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  const boundedRead = source.indexOf("readBoundedJsonBody(request, MAX_REQUEST_BYTES)");
  const fieldRead = source.indexOf("payload.image", boundedRead);
  const budget = source.indexOf('takePocketBudget(request, "analyse")', boundedRead);
  assert.ok(boundedRead >= 0 && boundedRead < fieldRead && fieldRead < budget);
  assert.match(source, /error instanceof RequestBodyTooLargeError[\s\S]*?status: 413/);
});
