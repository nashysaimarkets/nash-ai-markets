import assert from "node:assert/strict";
import test from "node:test";
import {
  createIgDemoReadOnlyClient,
  IG_DEMO_API_ORIGIN,
} from "../app/lib/server/ntp-ig-demo-read-only.ts";

const session = { apiKey: "demo-api-key", cst: "demo-cst", securityToken: "demo-token" };

test("NTP IG bridge never offers an order-submission method", () => {
  const bridge = createIgDemoReadOnlyClient(session, async () => {
    throw new Error("unused");
  });
  assert.deepEqual(Object.keys(bridge).sort(), ["getAccounts", "getPositions"]);
  assert.equal(Object.isFrozen(bridge), true);
  assert.equal("placeOrder" in bridge, false);
  assert.equal("executeTrade" in bridge, false);
});

test("IG demo accounts GET pins demo origin, credentials stay in headers and no cache", async () => {
  let requested = false;
  const bridge = createIgDemoReadOnlyClient(session, async (url, init) => {
    requested = true;
    assert.equal(url, "https://demo-api.ig.com/gateway/deal/accounts");
    assert.equal(init?.method, "GET");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.credentials, "omit");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("X-IG-API-KEY"), session.apiKey);
    assert.equal(headers.get("CST"), session.cst);
    assert.equal(headers.get("X-SECURITY-TOKEN"), session.securityToken);
    assert.equal(headers.get("Version"), "1");
    assert.equal(String(url).includes("demo-token"), false);
    return new Response(JSON.stringify({ accounts: [] }), { status: 200 });
  });
  assert.equal(IG_DEMO_API_ORIGIN, "https://demo-api.ig.com");
  assert.deepEqual(await bridge.getAccounts(), { accounts: [] });
  assert.equal(requested, true);
});

test("positions are read only, pinned to IG demo and pass cancellation", async () => {
  const controller = new AbortController();
  const bridge = createIgDemoReadOnlyClient(session, async (url, init) => {
    assert.equal(url, "https://demo-api.ig.com/gateway/deal/positions");
    assert.equal(init?.method, "GET");
    assert.equal(new Headers(init?.headers).get("Version"), "2");
    assert.ok(init?.signal instanceof AbortSignal);
    assert.equal(init.signal.aborted, false);
    return new Response(JSON.stringify({ positions: [] }), { status: 200 });
  });
  assert.deepEqual(await bridge.getPositions(controller.signal), { positions: [] });
});

test("rejects blank, multiline and oversized secrets before any request", () => {
  const invalid = [
    { ...session, apiKey: "" },
    { ...session, cst: "   " },
    { ...session, securityToken: "token\nheader: evil" },
    { ...session, apiKey: "a".repeat(4097) },
  ];
  for (const s of invalid) assert.throws(() => createIgDemoReadOnlyClient(s), /IG_DEMO_MISSING_OR_INVALID_/);
});

test("provider rejection returns only sanitised HTTP status", async () => {
  const bridge = createIgDemoReadOnlyClient(session, async () =>
    new Response("Secret token demo-token and user account", { status: 401 }));
  await assert.rejects(bridge.getAccounts(), { message: "IG_DEMO_HTTP_401" });
});

test("network errors never echo keys or provider payloads", async () => {
  const bridge = createIgDemoReadOnlyClient(session, async () => {
    throw new Error("demo-token network request leaked");
  });
  await assert.rejects(bridge.getAccounts(), { message: "IG_DEMO_TRANSPORT_UNAVAILABLE" });
});

test("invalid JSON fails closed without raw provider body", async () => {
  const bridge = createIgDemoReadOnlyClient(session, async () =>
    new Response("{ demo-token invalid", { status: 200 }));
  await assert.rejects(bridge.getPositions(), { message: "IG_DEMO_INVALID_RESPONSE" });
});


test("rejects control, whitespace and non-ASCII credentials before transport", () => {
  for (const field of ["apiKey", "cst", "securityToken"]) {
    for (const value of ["x\0y", "x\ty", "x\x7fy", "x y", " x", "xé", undefined, 42]) {
      assert.throws(() => createIgDemoReadOnlyClient({ ...session, [field]: value }), /IG_DEMO_MISSING_OR_INVALID_/);
    }
  }
});

test("rejects missing session and browser construction without a request", () => {
  assert.throws(() => createIgDemoReadOnlyClient(null as never), /IG_DEMO_SESSION_REQUIRED/);
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  try {
    assert.throws(() => createIgDemoReadOnlyClient(session), /IG_DEMO_SERVER_ONLY/);
  } finally { Reflect.deleteProperty(globalThis, "window"); }
});

test("already cancelled calls never reach transport or echo abort reason", async () => {
  const controller = new AbortController();
  controller.abort("private-token");
  let calls = 0;
  const bridge = createIgDemoReadOnlyClient(session, async () => { calls++; throw Error("unexpected"); });
  await assert.rejects(bridge.getAccounts(controller.signal), { message: "IG_DEMO_CANCELLED" });
  assert.equal(calls, 0);
});

test("in-flight cancellation propagates and does not retry", async () => {
  const controller = new AbortController();
  let calls = 0;
  const bridge = createIgDemoReadOnlyClient(session, async (_url, init) => {
    calls++;
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Error("private-token")), { once: true });
      controller.abort("private-reason");
    });
  });
  await assert.rejects(bridge.getPositions(controller.signal), { message: "IG_DEMO_CANCELLED" });
  assert.equal(calls, 1);
});

test("deadline aborts a stalled transport with a sanitised timeout", async () => {
  // Mock the deadline factory, not elapsed time or a real network request.
  const original = AbortSignal.timeout;
  const deadline = new AbortController();
  AbortSignal.timeout = (ms) => { assert.equal(ms, 10_000); return deadline.signal; };
  try {
    const bridge = createIgDemoReadOnlyClient(session, async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Error("private-token")), { once: true });
      deadline.abort();
    }));
    await assert.rejects(bridge.getAccounts(), { message: "IG_DEMO_TIMEOUT" });
  } finally { AbortSignal.timeout = original; }
});

test("oversized chunked bodies are cancelled without returning provider content", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(1_048_577)); },
    cancel() { cancelled = true; },
  });
  const bridge = createIgDemoReadOnlyClient(session, async () => new Response(body));
  await assert.rejects(bridge.getAccounts(), { message: "IG_DEMO_RESPONSE_TOO_LARGE" });
  assert.equal(cancelled, true);
});

test("body read failures are sanitised", async () => {
  const body = new ReadableStream({ start(controller) { controller.error(Error("private-token")); } });
  const bridge = createIgDemoReadOnlyClient(session, async () => new Response(body));
  await assert.rejects(bridge.getAccounts(), { message: "IG_DEMO_TRANSPORT_UNAVAILABLE" });
});

test("parallel clients snapshot their own headers despite caller mutation", async () => {
  const a = { ...session };
  const b = { apiKey: "other-key", cst: "other-cst", securityToken: "other-token" };
  const seen: string[] = [];
  const transport: typeof fetch = async (_url, init) => {
    const h = new Headers(init?.headers);
    await Promise.resolve();
    seen.push([h.get("X-IG-API-KEY"), h.get("CST"), h.get("X-SECURITY-TOKEN")].join(":"));
    assert.equal(init?.body, undefined);
    assert.equal(h.has("_method"), false);
    return new Response('{"accounts":[]}');
  };
  const first = createIgDemoReadOnlyClient(a, transport);
  const second = createIgDemoReadOnlyClient(b, transport);
  a.cst = "mutated";
  await Promise.all([first.getAccounts(), second.getAccounts(), first.getPositions()]);
  assert.deepEqual(seen.sort(), ["demo-api-key:demo-cst:demo-token", "demo-api-key:demo-cst:demo-token", "other-key:other-cst:other-token"].sort());
});

test("429 and server failures make exactly one attempt and discard body", async () => {
  for (const status of [403, 429, 500, 503]) {
    let calls = 0;
    const bridge = createIgDemoReadOnlyClient(session, async () => {
      calls++; return new Response("private-token", { status });
    });
    await assert.rejects(bridge.getAccounts(), { message: `IG_DEMO_HTTP_${status}` });
    assert.equal(calls, 1);
  }
});

test("cancellation during response-body consumption never returns partial data", async () => {
  const controller = new AbortController();
  let cancelled = false;
  const body = new ReadableStream({
    pull(stream) {
      stream.enqueue(new TextEncoder().encode('{"accounts":[]')); controller.abort("private-token");
    },
    cancel() { cancelled = true; },
  });
  const bridge = createIgDemoReadOnlyClient(session, async () => new Response(body));
  await assert.rejects(bridge.getAccounts(controller.signal), { message: "IG_DEMO_CANCELLED" });
  assert.equal(cancelled, true);
});

test("invalid UTF-8 never becomes a permissively decoded response", async () => {
  const bridge = createIgDemoReadOnlyClient(session, async () => new Response(new Uint8Array([0xff])));
  await assert.rejects(bridge.getAccounts(), { message: "IG_DEMO_INVALID_RESPONSE" });
});
