import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { executeReservedPocketProviderCall, withPocketTestSpendScope } from "../app/api/pocket/torture/provider-spend.ts";

const input = { ledgerKey: "test-only", requestKey: "case:call-1", projectRef: "test-project", ownerApprovalRef: "test-approval", estimatedMicroUsd: 100000 };
const allowed = { allowed: true, status: "reserved", reservation_id: "r1", committed_microusd: 100000, remaining_microusd: 1900000 };
const submitted = { ok: true, status: "submitted", reservation_id: "r1", claimed: true };

test("live scope stays held before database configuration or provider dispatch", async () => {
  let calls = 0;
  await assert.rejects(() => withPocketTestSpendScope("range-clear", async () => { calls++; }), /spending remains held/i);
  assert.equal(calls, 0);
});

function rpc(replies: unknown[]) {
  const calls: string[] = [];
  return { calls, client: { async rpc(name: string) { calls.push(name); return { data: replies.shift(), error: null }; } } };
}

test("provider dispatch waits for durable reservation and exclusive submit claim", async () => {
  const ledger = rpc([allowed, submitted, { ok: true, status: "submitted", reservation_id: "r1" }]);
  let sent = 0;
  const result = await executeReservedPocketProviderCall(ledger.client, input, async () => {
    assert.deepEqual(ledger.calls, ["reserve_pocket_test_spend", "submit_pocket_test_spend"]);
    sent++;
    return { _request_id: "req-test", id: "resp-test", model: "test-model", usage: { input_tokens: 100, output_tokens: 20 } };
  });
  assert.equal(result.id, "resp-test");
  assert.equal(sent, 1);
  assert.deepEqual(ledger.calls, ["reserve_pocket_test_spend", "submit_pocket_test_spend", "record_pocket_test_spend_receipt"]);
});

test("denied budgets and duplicate claims dispatch nothing", async () => {
  for (const replies of [[{ allowed: false, reason: "cumulative_cap_exceeded" }], [allowed, { ...submitted, claimed: false }]]) {
    let sent = 0;
    await assert.rejects(() => executeReservedPocketProviderCall(rpc(replies).client, input, async () => { sent++; return {}; }));
    assert.equal(sent, 0);
  }
});

test("provider failure and missing receipt retain submitted uncertainty without settlement or void", async () => {
  const ledger = rpc([allowed, submitted]);
  await assert.rejects(() => executeReservedPocketProviderCall(ledger.client, input, async () => { throw new Error("timeout after possible charge"); }), /timeout/);
  assert.deepEqual(ledger.calls, ["reserve_pocket_test_spend", "submit_pocket_test_spend"]);
  const missing = rpc([allowed, submitted]);
  await assert.rejects(() => executeReservedPocketProviderCall(missing.client, input, async () => ({})), /receipt/i);
  assert.deepEqual(missing.calls, ["reserve_pocket_test_spend", "submit_pocket_test_spend"]);
});

test("both live harnesses establish a spend scope and every analysis/precision call uses it", async () => {
  const route = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  assert.equal((route.match(/dispatchPocketAnalysisProviderCall\(/g) ?? []).length, 2);
  assert.equal((route.match(/client\.responses\.create\(/g) ?? []).length, 2);
  assert.equal((route.match(/dispatchPocketAnalysisProviderCall\([^\n]+=> client\.responses\.create\(/g) ?? []).length, 2);
  for (const file of ["../app/api/pocket/torture/route.ts", "../scripts/run-pocket-image-torture.ts"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /withPocketTestSpendScope/);
    assert.match(source, /isCumulativeTestSpendHeld/);
  }
});
