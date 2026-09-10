import test from "node:test";
import assert from "node:assert/strict";
import { precisionReceiptKey, readPrecisionReceipt, signPrecisionReceipt } from "../app/api/pocket/precision-receipt";
import { ChartWorkQueue } from "../app/pocket/chart-work-queue";

test("signed evidence is bound to exact pixels, model, corrections, prompt and expiry", () => {
  const secret = "test-secret-only";
  const key = precisionReceiptKey("pixels-a", "model-a", null, "instructions-a");
  const output = JSON.stringify({ levels: [{ price: 123.45 }] });
  const token = signPrecisionReceipt(key, output, secret, 1000)!;
  assert.equal(readPrecisionReceipt([token], key, secret, 1001), output);
  assert.equal(readPrecisionReceipt([token], key, secret, 901000), null);
  assert.equal(readPrecisionReceipt([token], key, "wrong-secret", 1001), null);
  for (const changed of [precisionReceiptKey("pixels-b", "model-a", null, "instructions-a"), precisionReceiptKey("pixels-a", "model-b", null, "instructions-a"), precisionReceiptKey("pixels-a", "model-a", "124", "instructions-a"), precisionReceiptKey("pixels-a", "model-a", null, "instructions-b")]) assert.equal(readPrecisionReceipt([token], changed, secret, 1001), null);
  const [payload, signature] = token.split(".");
  const tampered = JSON.parse(Buffer.from(payload, "base64url").toString());
  tampered.output = '{"levels":[{"price":999}]}';
  assert.equal(readPrecisionReceipt([`${Buffer.from(JSON.stringify(tampered)).toString("base64url")}.${signature}`], key, secret, 1001), null);
  assert.equal(signPrecisionReceipt(key, output, undefined), null);
});

test("selecting a warming timeframe shares its work instead of starting another scan", async () => {
  const queue = new ChartWorkQueue<number>();
  let finish!: (n: number) => void, count = 0;
  const work = queue.request("5m", () => { count++; return new Promise<number>((resolve) => { finish = resolve; }); }, true);
  const selected = queue.request("5m", async () => { throw Error("duplicate scan"); });
  assert.equal(work, selected);
  await Promise.resolve(); finish(7);
  assert.equal(await selected, 7); assert.equal(count, 1);
});

test("a selection preserves active background work and runs before other queued charts", async () => {
  const queue = new ChartWorkQueue<string>(); const order: string[] = [];
  let finish!: (value: string) => void;
  let activeSignal!: AbortSignal;
  const background = queue.request("old", (signal) => new Promise<string>((resolve) => { order.push("old"); activeSignal = signal; finish = resolve; }), true);
  await Promise.resolve();
  const later = queue.request("later", async () => { order.push("later"); return "later"; }, true);
  const chosen = queue.request("chosen", async () => { order.push("chosen"); return "chosen"; });
  assert.equal(activeSignal.aborted, false);
  finish("old"); assert.equal(await background, "old");
  assert.equal(await chosen, "chosen"); await later;
  assert.deepEqual(order, ["old", "chosen", "later"]);
});

test("reset rejects queued work and aborts the active session", async () => {
  const queue = new ChartWorkQueue<string>();
  const active = queue.request("a", (signal) => new Promise<string>((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")))));
  const pending = queue.request("b", async () => "must not run");
  const checks = [assert.rejects(active, { name: "AbortError" }), assert.rejects(pending, { name: "AbortError" })];
  await Promise.resolve(); queue.clear(); await Promise.all(checks);
});

test("a click arriving just after completion reuses that report until the session is cleared", async () => {
  const queue = new ChartWorkQueue<number>(); let calls = 0;
  const run = async () => ++calls;
  assert.equal(await queue.request("chart", run, true), 1);
  await new Promise(setImmediate);
  assert.equal(await queue.request("chart", run), 1);
  queue.clear();
  assert.equal(await queue.request("chart", run), 2);
});


test("a cancelled non-cooperative image job cannot block the next session", async () => {
  const queue = new ChartWorkQueue<string>();
  const old = queue.request("old", () => new Promise(() => {}));
  const cancelled = assert.rejects(old, { name: "AbortError" });
  await new Promise(setImmediate);
  queue.clear();
  const next = queue.request("new", async () => "ready");
  await cancelled;
  assert.equal(await next, "ready");
});

test("a timed-out chart releases its lane and its late result cannot replace a retry", async () => {
  const queue = new ChartWorkQueue<string>(1, 10);
  let finish!: (value: string) => void;
  const stuck = queue.request("one", () => new Promise(resolve => { finish = resolve; }));
  const failed = assert.rejects(stuck, /could not finish/);
  const sibling = queue.request("two", async () => "second ready");
  await failed;
  assert.equal(await sibling, "second ready");
  assert.equal(await queue.request("one", async () => "retry ready"), "retry ready");
  finish("stale");
  await new Promise(setImmediate);
  assert.equal(await queue.request("one", async () => "unexpected"), "retry ready");
});
