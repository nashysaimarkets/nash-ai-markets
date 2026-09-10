import assert from "node:assert/strict";
import test from "node:test";
import { runPocketReport, PocketReportTimeoutError, reportServiceTier } from "../app/api/pocket/report-recovery.ts";
import { completedPocketReportOutput, PocketReportCompletionError } from "../app/api/pocket/report-completion.ts";

const options = () => ({ signal: new AbortController().signal, deadlineAt: Date.now() + 5_000, attemptTimeoutMs: 20, recoveryTimeoutMs: 100 });

test("a stalled five-chart report is cancelled before one complete recovery", async () => {
  const images = ["primary", "context", "detail", "fourHour", "indicator"];
  const attempts: boolean[] = [];
  let firstSignal: AbortSignal | undefined;
  const result = await runPocketReport(async ({ signal, recovery }) => {
    attempts.push(recovery);
    if (!recovery) {
      firstSignal = signal;
      await new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
    }
    assert.equal(firstSignal?.aborted, true);
    const response = { status: "completed", output_text: JSON.stringify({ received: images }) };
    completedPocketReportOutput(response);
    return response;
  }, options());
  assert.deepEqual(attempts, [false, true]);
  assert.deepEqual(JSON.parse(result.output_text).received, images);
});

test("completed reports use exactly one call", async () => {
  let calls = 0;
  assert.equal(await runPocketReport(async () => { calls++; return "complete"; }, options()), "complete");
  assert.equal(calls, 1);
});

test("output exhaustion can recover but two incomplete reports never become a result", async () => {
  let calls = 0;
  await assert.rejects(runPocketReport(async () => {
    calls++;
    throw new PocketReportCompletionError("max_output_tokens", 500);
  }, options()), PocketReportCompletionError);
  assert.equal(calls, 2);
});

test("quota, authentication, rate limits, filtering and bad requests are not retried", async () => {
  for (const error of [{ status: 429, code: "insufficient_quota" }, { status: 401 }, { status: 429 }, { status: 400 }, new PocketReportCompletionError("content_filter", 0)]) {
    let calls = 0;
    await assert.rejects(runPocketReport(async () => { calls++; throw error; }, options()));
    assert.equal(calls, 1);
  }
});

test("user cancellation never starts a recovery", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(runPocketReport(async () => {
    calls++;
    controller.abort(new Error("user cancelled"));
    throw new Error("Request timed out.");
  }, { ...options(), signal: controller.signal }), /user cancelled/);
  assert.equal(calls, 1);
});

test("recovery cannot exceed the remaining total budget", async () => {
  let calls = 0;
  await runPocketReport(async ({ timeoutMs, recovery }) => {
    calls++;
    if (!recovery) throw new Error("Request timed out.");
    assert.ok(timeoutMs <= 2_000);
    return "complete";
  }, { ...options(), deadlineAt: Date.now() + 2_000, recoveryTimeoutMs: 10_000 });
  assert.equal(calls, 2);
});

test("exhausted timers remain a typed timeout even when the SDK says only aborted", async () => {
  let calls = 0;
  await assert.rejects(runPocketReport(async ({ signal }) => {
    calls++;
    return new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("Request was aborted.")), { once: true }));
  }, { ...options(), recoveryTimeoutMs: 20 }), PocketReportTimeoutError);
  assert.equal(calls, 2);
});
test("recovery leaves the stalled priority tier without changing the report model", () => {
  assert.equal(reportServiceTier(true, false), "priority");
  assert.equal(reportServiceTier(true, true), "default");
  assert.equal(reportServiceTier(false, false), "default");
});

test("real output keeps a progressing report past its soft timer without a second paid attempt", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
  let progress!: () => void, finish!: (s: string) => void, calls = 0;
  const result = runPocketReport(({ signal, noteOutputProgress }) => {
    calls++; progress = noteOutputProgress;
    return new Promise<string>((resolve, reject) => { finish = resolve; signal.addEventListener("abort", () => reject(signal.reason), { once: true }); });
  }, { ...options(), attemptTimeoutMs: 50, progressIdleTimeoutMs: 50, progressExtensionMs: 100 });
  t.mock.timers.tick(40); progress(); t.mock.timers.tick(40); progress(); t.mock.timers.tick(20);
  finish("complete verified report");
  assert.equal(await result, "complete verified report"); assert.equal(calls, 1);
});
test("output that stops still triggers bounded recovery", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
  let progress!: () => void, calls = 0;
  const result = runPocketReport(({ signal, recovery, noteOutputProgress }) => {
    calls++; progress = noteOutputProgress;
    if (recovery) return Promise.resolve("recovered");
    return new Promise<string>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  }, { ...options(), attemptTimeoutMs: 50, progressIdleTimeoutMs: 50, progressExtensionMs: 100 });
  t.mock.timers.tick(40); progress(); t.mock.timers.tick(50);
  assert.equal(await result, "recovered"); assert.equal(calls, 2);
});
test("continuous output cannot extend the total deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
  let progress!: () => void;
  const result = runPocketReport(({ signal, noteOutputProgress }) => {
    progress = noteOutputProgress;
    return new Promise<string>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  }, { ...options(), deadlineAt: 1120, attemptTimeoutMs: 50, progressIdleTimeoutMs: 50, progressExtensionMs: 100 });
  const rejected = assert.rejects(result, PocketReportTimeoutError);
  for (let i = 0; i < 3; i++) { t.mock.timers.tick(30); progress(); }
  t.mock.timers.tick(30); await rejected;
});


test("an early output stall recovers after the idle budget instead of waiting for the initial deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
  let progress!: () => void, calls = 0;
  const result = runPocketReport(({ signal, recovery, noteOutputProgress }) => {
    calls++; progress = noteOutputProgress;
    if (recovery) return Promise.resolve("recovered");
    return new Promise<string>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  }, { ...options(), attemptTimeoutMs: 750, progressIdleTimeoutMs: 150, progressExtensionMs: 300 });
  t.mock.timers.tick(100); progress(); t.mock.timers.tick(150);
  await Promise.resolve();
  assert.equal(calls, 2, "recover at 250ms, before the 750ms initial deadline");
  assert.equal(await result, "recovered");
});
