import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { executePocketFirstFreeRequest, claimPocketFirstFreeProviderDispatch, firstFreePayloadKeys } from "../app/lib/server/pocket-first-free.ts";

const user = { id: "7a9d6268-93d5-43ec-bd05-15f074e35bcc", email: "member@example.invalid" };
const payload = { image: "data:image/png;base64,AAAA", contextImage: "", chartConfirmation: { instrument: "US 500", timeframe: "5m", currentPrice: "100", contextMatch: "NOT_PROVIDED" } };
const request = (path = "analyse", body = payload, signal?: AbortSignal) => new Request(`https://example.invalid/api/pocket/${path}`, { method: "POST", body: JSON.stringify(body), signal });
function ledger(reserve = { allowed: true, status: "reserved", lease: "lease" }) {
  const calls: Array<[string, Record<string, unknown>]> = [];
  return { calls, rpc: async (name: string, args: Record<string, unknown>) => { calls.push([name, args]); return { data: name === "reserve_pocket_first_free" ? reserve : { ok: true }, error: null }; } };
}
test("free requests exclusively claim before dispatch and persist replayable responses", async () => {
  const db = ledger(); let calls = 0;
  const response = await executePocketFirstFreeRequest(request(), user, db, async () => {
    await Promise.all([claimPocketFirstFreeProviderDispatch(), claimPocketFirstFreeProviderDispatch()]); calls++;
    return Response.json({ analysis: { levels: [] } });
  });
  assert.equal(response.status, 200); assert.equal(calls, 1);
  assert.deepEqual(db.calls.map(([name]) => name), ["reserve_pocket_first_free", "claim_pocket_first_free", "finish_pocket_first_free"]);
  assert.equal(db.calls[2][1].p_dispatched, true);
});
test("durable replay, busy and used decisions never execute the handler", async () => {
  for (const [decision, status] of [[{ allowed: false, status: "replay", response_status: 200, response_body: { analysis: { levels: [] } } }, 200], [{ allowed: false, status: "busy" }, 409], [{ allowed: false, status: "used" }, 403], [{ allowed: false, status: "disabled" }, 403]] as const) {
    const db = ledger(decision as never);
    const result = await executePocketFirstFreeRequest(request(), user, db, async () => { throw new Error("duplicate dispatch"); });
    assert.equal(result.status, status); assert.equal(db.calls.length, 1);
  }
});
test("pre-dispatch validation/cancellation releases; dispatched cancellation never replenishes", async () => {
  const db = ledger();
  assert.equal((await executePocketFirstFreeRequest(request(), user, db, async () => Response.json({ error: "bad image" }, { status: 400 }))).status, 400);
  assert.equal(db.calls.at(-1)?.[1].p_dispatched, false);
  const cancelled = new AbortController(); cancelled.abort();
  const unused = ledger();
  assert.equal((await executePocketFirstFreeRequest(request("analyse", payload, cancelled.signal), user, unused, async () => { throw new Error("must not run"); })).status, 499);
  assert.equal(unused.calls.length, 0);
  const after = ledger();
  assert.equal((await executePocketFirstFreeRequest(request(), user, after, async () => { await claimPocketFirstFreeProviderDispatch(); throw new DOMException("cancel", "AbortError"); })).status, 503);
  assert.equal(after.calls.at(-1)?.[1].p_dispatched, true);
});
test("ledger outages, malformed decisions and failed claims fail closed", async () => {
  for (const failAt of ["reserve_pocket_first_free", "claim_pocket_first_free", "finish_pocket_first_free"]) {
    let dispatches = 0;
    const base = ledger();
    const db = { rpc: async (name: string, args: Record<string, unknown>) => name === failAt ? { data: null, error: { message: "offline" } } : base.rpc(name, args) };
    const result = await executePocketFirstFreeRequest(request(), user, db, async () => { await claimPocketFirstFreeProviderDispatch(); dispatches++; return Response.json({ analysis: {} }); });
    assert.equal(result.status, 503); assert.equal(dispatches, failAt === "finish_pocket_first_free" ? 1 : 0);
  }
});
test("hashes bind preflight and analysis to primary/context while retries bind the whole payload", () => {
  const keys = firstFreePayloadKeys(payload);
  assert.equal(keys.imageKey, firstFreePayloadKeys({ ...payload, intention: "SHORT" }).imageKey);
  assert.notEqual(keys.requestKey, firstFreePayloadKeys({ ...payload, intention: "SHORT" }).requestKey);
  for (const change of [{ image: "other" }, { contextImage: "other" }]) assert.notEqual(keys.imageKey, firstFreePayloadKeys({ ...payload, ...change }).imageKey);
});
test("only preflight/analyse can receive first-free access; all real provider calls claim durable admission", async () => {
  const other = ledger();
  assert.equal((await executePocketFirstFreeRequest(request("levels"), user, other, async () => { throw new Error("bypass"); })).status, 403);
  assert.equal(other.calls.length, 0);
  const openai = await readFile(new URL("../app/lib/server/openai.ts", import.meta.url), "utf8");
  assert.match(openai, /claimPocketFirstFreeProviderDispatch/);
  for (const route of ["preflight", "analyse"]) {
    const source = await readFile(new URL(`../app/api/pocket/${route}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /withPocketFirstFreeRequest\(request/);
  }
});
test("free upload size and malformed JSON are rejected before reserving allowance", async () => {
  for (const req of [new Request('https://example.invalid/api/pocket/preflight', {method:'POST', body:JSON.stringify(payload), headers:{'content-length':'23000001'}}), new Request('https://example.invalid/api/pocket/preflight', {method:'POST', body:'{broken'})]) {
    const db=ledger();
    const result=await executePocketFirstFreeRequest(req,user,db,async()=>{throw new Error('must not run');});
    assert.equal(result.status,req.headers.has('content-length')?413:400);
    assert.equal(db.calls.length,0);
  }
});
