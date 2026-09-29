import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { postLevelLabScan } from "../app/pocket/level-lab-client";
import { postLiquidityRescan } from "../app/pocket/liquidity-rescan-client";

class LegacySignal extends EventTarget { aborted = false; }
class LegacyController {
  signal = new LegacySignal();
  abort() { if (!this.signal.aborted) { this.signal.aborted = true; this.signal.dispatchEvent(new Event("abort")); } }
}

test("deadlines work in older WebViews without abort reasons or modern signal methods", async () => {
  const source = readFileSync(new URL("../app/pocket/async-deadline.ts", import.meta.url), "utf8");
  const compiled = ts.transpile(source, { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS });
  const context = vm.createContext({ exports: {}, AbortController: LegacyController, DOMException, setTimeout, clearTimeout });
  vm.runInContext(compiled, context);
  const run = context.exports.withDeadline;
  assert.equal(await run(async () => "ready", 100, "expired"), "ready");
  await assert.rejects(run(() => new Promise(() => {}), 10, "expired"), /expired/);
  const first = new LegacyController();
  const second = new LegacyController();
  const pending = run(() => new Promise(() => {}), 1000, "expired", [first.signal, second.signal]);
  second.abort();
  await assert.rejects(pending, { name: "AbortError" });
  await assert.rejects(run(async () => { throw new Error("must not start"); }, 1000, "expired", second.signal), { name: "AbortError" });
});

for (const [name, scan] of [["levels", postLevelLabScan], ["liquidity", postLiquidityRescan]] as const) {
  test(`${name}: a response body ignoring cancellation cannot hold recovery open`, async () => {
    let calls = 0;
    await assert.rejects(scan("{}", async () => {
      calls++;
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("{")); } }));
    }, { deadlineAt: Date.now() + 20 }), /took too long/);
    assert.equal(calls, 1);
  });
}
