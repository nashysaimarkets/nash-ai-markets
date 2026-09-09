import assert from "node:assert/strict";
import test from "node:test";
import { runPocketReport } from "../app/api/pocket/report-recovery.ts";
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
