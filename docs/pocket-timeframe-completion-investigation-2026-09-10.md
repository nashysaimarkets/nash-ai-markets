# Pocket Bullseye timeframe completion investigation

## Evidence and diagnosis

The reported symptom is a completed daily report with other uploaded timeframes remaining on “Analysing”. The screenshot establishes the displayed state, but does not establish how long the jobs had run, the installed build, or which asynchronous operation was pending.

Vercel runtime evidence from 10 September 2026 shows a five-chart request at 18:03:12 UTC on deployment `dpl_2xDyeUVFwbwRptPuBd8THAggvGoz`. The report completed successfully in approximately 74.4 seconds; precision completed in 36.1 seconds. Four provider responses were recorded. That request did not fail from exhausted AI credits. It cannot by itself prove that a particular phone received and displayed the response. Economic-calendar requests separately returned 429; those warnings did not prevent this report completing.

The inspected release source contains several definite unbounded waits. These are independently reproducible defects consistent with the symptom; the screenshot alone does not prove which one occurred on the phone.

| Failure path | Prior behaviour | Repair |
| --- | --- | --- |
| HTTP body stalls after headers | The timeout was cleared when `fetch()` resolved; later `response.json()` had no deadline. | Keep the deadline through complete response-body consumption and preserve response status and headers. |
| IndexedDB open or read does not settle | Every chart waited for the optional local cache before making its request. | Bound cache access, handle blocked opens and close late database connections. |
| Cache write stalls after a valid report | The result was withheld until disk persistence completed. | Return the validated report to the in-memory cache immediately; save to disk independently. |
| Cancelled queue task ignores AbortSignal | An active task retained its lane until its own promise settled, preventing subsequent jobs from starting. | Race cancellation and the whole-job deadline, release the lane, reject late results and retain deduplication. |
| Image decoding or preparation stalls | The shared image lane could hold every other chart indefinitely. | Bound image work to 30 seconds, propagate session cancellation and check cancellation between decodes. |
| Optional recovery image fails | A finished report could be discarded while preparing an optional additional check. | Retain the original verified/held report when recovery images cannot be prepared. Never fabricate missing evidence. |
| Phone suspends timers | A resumed page could retain a deadline based on suspended timer delivery. | Reconcile elapsed wall-clock time on visibility changes and page restoration. |

The existing buttons now distinguish Preparing, Analysing and Verifying. These labels describe actual processing stages; they do not manufacture percentage progress. Layout, chart evidence, models, reasoning effort, report schema and precision gates are preserved. A failed task remains explicitly retryable; finished sibling reports remain available. Switching a prepared chart does not make a new paid request.

## Why a larger timeout or more model calls is insufficient

The browser Fetch API resolves at response headers, before the response body is necessarily available.[1] A timeout that ends there does not protect parsing. IndexedDB explicitly supports a blocked-open condition, so assuming every open will quickly succeed is also unsafe.[2] Cancellation is cooperative unless the caller separately settles its own task; this is why queue occupancy must be bounded independently.

Moving work into a `waitUntil()` callback alone would not make it durable: Vercel documents that such work still shares the function timeout.[3] A future architecture supporting app termination and reopening would need authenticated persisted job records, idempotent submission, durable execution and result retrieval. This repair does not claim that memory-held scans survive force-quitting the app.

OpenAI identifies generated output and repeated requests as major latency contributors.[4] The measured 74-second report confirms that provider latency remains material even after client orchestration is repaired. Reducing output or changing the model without a representative accuracy benchmark would conflict with the requirement to preserve precision. No universal instant-completion or accuracy claim is supported by these checks.

## Verification

The updated Site source passed 1,030 unit tests, 13 rendering tests, TypeScript, the secret-pattern check and the production Worker build. Targeted tests execute the actual component request and selection handlers with five distinct fictional charts, keep image work serial, hold one provider response while three siblings complete, switch repeatedly without additional calls, and verify that a stalled persistence operation does not withhold completed reports. New transport tests send headers with an unfinished body; queue tests use promises that ignore cancellation and deliver stale results after a retry.

The native source was merged onto the latest build-31 application variant, preserving its existing progress stages, completion notification and decision timeline. The native TypeScript check and 20 targeted regression tests passed. These checks establish orchestration correctness under the tested failures. They are not a live-provider speed benchmark, a physical-iPhone acceptance test or proof that every market screenshot is interpreted correctly.

## Release distinction

Apple build 31 is pinned to immutable web revision `51c260fa80d40e47f94d1d9796f0eff2e0b94a16`. Updating the Sites URL cannot change that installed binary's pin. A matching native update must pass its own build and Apple review flow. Release status and any live verification results must be recorded after their outcomes are confirmed.

## Sources

1. MDN, [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch), response headers, body consumption and cancellation; accessed 10 September 2026.
2. MDN, [IDBOpenDBRequest: blocked event](https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/blocked_event), database upgrade blocking; accessed 10 September 2026.
3. Vercel, [Functions API reference](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package), `waitUntil` timeout semantics; accessed 10 September 2026.
4. OpenAI, [Latency optimization](https://developers.openai.com/api/docs/guides/latency-optimization), output generation, request reduction and parallel execution; accessed 10 September 2026.
5. MDN, [AbortSignal.timeout](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static), active-time suspension behaviour; accessed 10 September 2026.
6. Private Vercel project runtime logs, deployment `dpl_2xDyeUVFwbwRptPuBd8THAggvGoz`, 10 September 2026, request `b0ef19c7-48da-44be-99d0-1fe63053d307`; authenticated access required.

## Live five-chart acceptance check

On 10 September 2026, the deployed repair `0b0d0c61d1fc3a9ba461b14929b85574c98eb376` (`dpl_GkS4uLr7rLyb3FCMkPaKDJR5vJ3Z`) was tested through the normal browser upload and Analyse flow with five clearly labelled fictional chart fixtures: 1D, 30M, 1H, 4H and 5M. This used the live provider, not the built-in sample result mode.

The main report completed in 52.1 seconds. All four background reports completed; their server durations were 41.7, 45.4, 142.9 and 152.0 seconds. Two exercised report recovery after a slow initial provider response. Including the main request before background work, server timings put the complete set at approximately 206 seconds; the browser observed all five ready by its next check at 225 seconds. All five analysis endpoints returned HTTP 200.

Every timeframe was selected and the corresponding result appeared. Visible pattern summaries changed from the daily range to the 30M, 1H and 5M trend channels; the 4H result explicitly withheld an unverified pattern. Repeated switching left the analysis request count at exactly five. Browser automation acknowledgement overhead is not an app-render latency measurement. No physical-iPhone or force-quit-resume claim follows from this test.
