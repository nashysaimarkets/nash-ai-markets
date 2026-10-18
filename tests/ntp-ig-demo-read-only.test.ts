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
    assert.equal(init?.signal, controller.signal);
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
