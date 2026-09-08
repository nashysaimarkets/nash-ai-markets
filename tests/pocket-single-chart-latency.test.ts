import test from "node:test";
import assert from "node:assert/strict";
import { pocketAnalysisPolicy, needsPocketLiquidityRecovery } from "../app/pocket/analysis-policy.ts";
import { postLevelLabScan } from "../app/pocket/level-lab-client.ts";
import { postLiquidityRescan } from "../app/pocket/liquidity-rescan-client.ts";

test("one chart has an overlapping bounded budget; adding any optional slot preserves the multi-chart window", () => {
  const single = pocketAnalysisPolicy({ image: "chart" });
  assert.equal(single.imageCount, 1);
  assert.equal(single.parallelPrecision, true);
  assert.ok(single.reportTimeoutMs < 120_000);
  assert.ok(single.precisionDeadlineMs < single.reportTimeoutMs);
  assert.ok(single.reportTimeoutMs < single.providerDeadlineMs);
  assert.ok(single.providerDeadlineMs < single.clientTimeoutMs);
  assert.ok(single.precisionCallTimeoutMs * 2 <= single.precisionDeadlineMs);
  for (const slot of ["contextImage", "detailImage", "fourHourImage", "indicatorImage"]) {
    const multi = pocketAnalysisPolicy({ image: "chart", [slot]: "extra" });
    assert.equal(multi.imageCount, 2);
    assert.equal(multi.parallelPrecision, false);
    assert.equal(multi.reportTimeoutMs, 240_000);
    assert.equal(multi.reportOutputTokens, 28_000);
  }
});

test("a verified absence of visible stop clusters is complete; unavailable evidence still permits recovery", () => {
  assert.equal(needsPocketLiquidityRecovery("NO_VISIBLE_RISK_ZONES"), false);
  assert.equal(needsPocketLiquidityRecovery("VISIBLE_RISK_ZONES"), false);
  assert.equal(needsPocketLiquidityRecovery("INSUFFICIENT_EVIDENCE"), true);
  assert.equal(needsPocketLiquidityRecovery(undefined), true);
});

for (const [name, scan] of [["levels", postLevelLabScan], ["liquidity", postLiquidityRescan]] as const) {
  test(`${name}: automatic recovery does not send work after its shared deadline`, async () => {
    let calls = 0;
    await assert.rejects(scan("{}", async () => { calls++; return new Response("{}"); }, { deadlineAt: Date.now() - 1 }));
    assert.equal(calls, 0);
  });

  test(`${name}: a stalled recovery is cancelled and never gets a fresh retry window`, async () => {
    let calls = 0;
    let aborted = false;
    await assert.rejects(scan("{}", async (_url, options) => {
      calls++;
      return new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }, { once: true });
      });
    }, { deadlineAt: Date.now() + 20 }), /took too long/);
    assert.equal(aborted, true);
    assert.equal(calls, 1);
  });
}
