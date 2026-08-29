import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("analyse applies one remaining deadline and abort signal to macro, report and precision work", async () => {
  const source = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  assert.match(source, /const providerDeadlineAt = routeStartedAt \+ POCKET_PROVIDER_DEADLINE_MS/);
  assert.match(source, /getVerifiedMacroContext\(\{ route: "\/api\/pocket\/analyse", signal: providerSignal \}\)/);
  assert.match(source, /timeout: Math\.min\(POCKET_ANALYSIS_TIMEOUT_MS, reportTimeoutMs\)/);
  assert.match(source, /const precisionCallBudget:[\s\S]*?deadlineAt: providerDeadlineAt,[\s\S]*?signal: providerSignal/);
  assert.match(source, /\}, \{ signal: providerSignal, timeout: Math\.min\(POCKET_ANALYSIS_TIMEOUT_MS, timeoutMs\) \}\)/);
});

test("report failure aborts and drains precision work before the route returns", async () => {
  const source = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  const reportFailureAbort = source.indexOf("providerAbortController.abort(error);", source.indexOf("const analysisRequest"));
  const precisionStart = source.indexOf("const precisionWork");
  const rescueGate = source.indexOf("await analysisRequest;", precisionStart);
  const firstRescue = source.indexOf("finishPrecision(primaryFirst", precisionStart);
  const drain = source.indexOf("await Promise.allSettled([analysisRequest, precisionWork])");
  assert.ok(reportFailureAbort >= 0 && reportFailureAbort < precisionStart);
  assert.ok(rescueGate > precisionStart && rescueGate < firstRescue);
  assert.ok(drain > precisionStart);
  assert.match(source, /firstFailure: providerSignal\.aborted \? "REQUEST_ABORTED" : "REQUEST_FAILED"/);
});

test("analyse bounds the aggregate body before parsing fields or taking provider budget", async () => {
  const source = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  const boundedRead = source.indexOf("readBoundedJsonBody(request, MAX_REQUEST_BYTES)");
  const fieldRead = source.indexOf("payload.image", boundedRead);
  const budget = source.indexOf('takePocketBudget(request, "analyse")', boundedRead);
  assert.ok(boundedRead >= 0 && boundedRead < fieldRead && fieldRead < budget);
  assert.match(source, /error instanceof RequestBodyTooLargeError[\s\S]*?status: 413/);
});
