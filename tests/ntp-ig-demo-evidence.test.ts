import assert from "node:assert/strict";
import test from "node:test";
import { createIgDemoEvidenceClient, createIgDemoReadOnlyClient } from "../app/lib/server/ntp-ig-demo-read-only.ts";

const session = { apiKey: "mock-key", cst: "mock-cst", securityToken: "mock-token" };
const history = { resolution: "MINUTE_5", from: "2026-10-19T09:00:00", to: "2026-10-19T10:00:00", max: 12 } as const;

test("metadata client permits only session, market and bounded history GETs", async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const client = createIgDemoEvidenceClient(session, { marketDetails: true, historicalPrices: true }, async (url, init) => {
    seen.push({ url: String(url), init }); return new Response("{}");
  });
  assert.deepEqual(Object.keys(client).sort(), ["getHistoricalPrices", "getMarket", "getSession"]);
  await client.getSession(); await client.getMarket("IX.D.SPTRD.DAILY.IP"); await client.getHistoricalPrices("IX.D.SPTRD.DAILY.IP", history);
  for (const { url, init } of seen) {
    assert.equal(new URL(url).origin, "https://demo-api.ig.com");
    assert.equal(init?.method, "GET"); assert.equal(init?.body, undefined);
    assert.equal(init?.redirect, "error"); assert.equal(init?.cache, "no-store");
  }
  const url = new URL(seen[2].url);
  assert.equal(url.searchParams.get("max"), "12"); assert.equal(url.searchParams.get("pageNumber"), "1");
  assert.equal(url.searchParams.get("pageSize"), "12", "IG ignores max when dates are supplied");
});

test("market and history reads default to denied when rights are absent", () => {
  let calls = 0;
  const rights = { marketDetails: false, historicalPrices: false };
  const client = createIgDemoEvidenceClient(session, rights, async () => { calls++; return new Response("{}"); });
  rights.marketDetails = true; rights.historicalPrices = true;
  assert.throws(() => client.getMarket("IX.D.SPTRD.DAILY.IP"), /IG_DEMO_MARKET_DATA_NOT_LICENSED/);
  assert.throws(() => client.getHistoricalPrices("IX.D.SPTRD.DAILY.IP", history), /IG_DEMO_MARKET_DATA_NOT_LICENSED/);
  assert.equal(calls, 0);
});

test("EPIC and query validation prevent host/path injection and unbounded historical paging", () => {
  let calls = 0;
  const client = createIgDemoEvidenceClient(session, { marketDetails: true, historicalPrices: true }, async () => { calls++; return new Response("{}"); });
  for (const epic of [".", "..", "https://api.ig.com", "../positions/otc", "IX.D.FOO?x=1", "IX.D.FOO#bar", "IX.D.FOO\nSECRET"]) {
    assert.throws(() => client.getMarket(epic), /IG_DEMO_INVALID_EPIC/);
    assert.throws(() => client.getHistoricalPrices(epic, history), /IG_DEMO_INVALID_EPIC/);
  }
  for (const query of [{ ...history, max: 0 }, { ...history, max: 101 }, { ...history, max: 1.5 }, { ...history, from: "2026-02-30T09:00:00" }, { ...history, resolution: "TICK" }, { ...history, from: history.to }, { ...history, to: "not-a-date" }]) {
    assert.throws(() => client.getHistoricalPrices("IX.D.SPTRD.DAILY.IP", query as never), /IG_DEMO_INVALID_HISTORY_QUERY/);
  }
  assert.equal(calls, 0);
});

test("non-cooperative stalled transport settles on cancellation without awaiting a late result", async () => {
  const abort = new AbortController();
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((r) => { resolve = r; });
  const client = createIgDemoReadOnlyClient(session, async () => promise);
  const request = client.getAccounts(abort.signal);
  const rejected = assert.rejects(request, { message: "IG_DEMO_CANCELLED" });
  abort.abort("mock-private-token");
  await rejected;
  let cancelled = false;
  resolve(new Response(new ReadableStream({ cancel() { cancelled = true; } })));
  await new Promise<void>((r) => { queueMicrotask(r); });
  assert.equal(cancelled, true);
});

test("stalled chunk read settles on cancellation and releases the response", async () => {
  const abort = new AbortController();
  let cancel = false;
  const started = new Promise<void>((r) => { queueMicrotask(r); });
  const client = createIgDemoReadOnlyClient(session, async () => new Response(new ReadableStream({ cancel() { cancel = true; } })));
  const request = client.getAccounts(abort.signal);
  const rejected = assert.rejects(request, { message: "IG_DEMO_CANCELLED" });
  await started;
  await new Promise<void>((r) => { setTimeout(r, 0); });
  abort.abort(); await rejected;
  assert.equal(cancel, true);
});

test("HTTP rejection is never held hostage by an uncooperative response cancel hook", async () => {
  let release!: () => void;
  const cleanup = new Promise<void>((r) => { release = r; });
  const client = createIgDemoReadOnlyClient(session, async () => new Response(new ReadableStream({ cancel() { return cleanup; } }), { status: 401 }));
  let settled = false;
  const request = client.getAccounts().catch((error: unknown) => { settled = true; throw error; });
  const rejected = assert.rejects(request, { message: "IG_DEMO_HTTP_401" });
  try {
    await new Promise<void>((r) => setImmediate(r));
    assert.equal(settled, true, "untrusted cleanup cannot delay the sanitized HTTP failure");
  } finally { release(); }
  await rejected;
});
