import assert from "node:assert/strict";
import test from "node:test";
import {
  POCKET_ANALYSIS_TIMEOUT_MESSAGE,
  formatPocketAnalysisCountdown,
  pocketAnalysisCountdownLabel,
  postPocketAnalysis,
} from "../app/pocket/analysis-request";

test("the customer countdown is truthful, stable-width and switches to final verification", () => {
  assert.equal(formatPocketAnalysisCountdown(95), "1:35");
  assert.equal(formatPocketAnalysisCountdown(9.2), "0:10");
  assert.equal(formatPocketAnalysisCountdown(-2), "0:00");
  assert.equal(pocketAnalysisCountdownLabel(21), "MEASURING STRUCTURE · UP TO 0:21 REMAINING");
  assert.equal(pocketAnalysisCountdownLabel(20), "FINAL VERIFICATION · UP TO 0:20 REMAINING");
});

test("a stalled mobile analysis aborts and returns a retryable error", async () => {
  let signal: AbortSignal | undefined;
  const fetchImpl = (_input: RequestInfo | URL, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return new Promise<Response>(() => undefined);
  };

  await assert.rejects(
    postPocketAnalysis("{}", { fetchImpl, timeoutMs: 5 }),
    { message: POCKET_ANALYSIS_TIMEOUT_MESSAGE },
  );
  assert.equal(signal?.aborted, true);
});

test("a completed analysis response clears the deadline and passes through", async () => {
  const expected = new Response(JSON.stringify({ analysis: { verdict: "WAIT" } }), { status: 200 });
  const actual = await postPocketAnalysis("{}", {
    fetchImpl: async () => expected,
    timeoutMs: 50,
  });
  assert.equal(actual.status, 200);
  assert.deepEqual(await actual.json(), { analysis: { verdict: "WAIT" } });
});


test("headers without a completed body cannot disable the analysis deadline", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"analysis":')); } });
  await assert.rejects(postPocketAnalysis("{}", { timeoutMs: 10, fetchImpl: async (_url, init) => {
    init?.signal?.addEventListener("abort", () => { cancelled = true; });
    return new Response(stream);
  }}), { message: POCKET_ANALYSIS_TIMEOUT_MESSAGE });
  assert.equal(cancelled, true);
});

test("cancellation settles even when the transport ignores its signal", async () => {
  const controller = new AbortController();
  const job = postPocketAnalysis("{}", { timeoutMs: 1000, signal: controller.signal, fetchImpl: () => new Promise(() => {}) });
  controller.abort();
  await assert.rejects(job, { name: "AbortError" });
});
