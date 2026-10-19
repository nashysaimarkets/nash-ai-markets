import assert from "node:assert/strict";
import test from "node:test";
import { createIgDemoConnection } from "../app/lib/server/ntp-ig-demo-connection.ts";
import type { IgDemoConnectionOptions } from "../app/lib/server/ntp-ig-demo-connection.ts";
import { igDemoChartContext, IG_DEMO_PANEL_ENABLED_BY_DEFAULT } from "../app/lib/ig-demo-panel.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const input = { identifier: "mock_user", password: "mock-only-password", selectedAccountId: "DEMO1" };
const account = { accountId: "DEMO1", accountType: "CFD", currency: "GBP", preferred: true, status: "ENABLED" };
const position = { market: { epic: "IX.D.SPTRD.DAILY.IP", bid: 10, offer: 11 }, position: { dealId: "DEAL-1", direction: "BUY", size: 0.5, level: 5100, currency: "GBP" } };
const chart = { source: "IG_DEMO", confirmed: true, epic: "IX.D.SPTRD.DAILY.IP", accountType: "CFD" } as const;
function json(body: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", ...headers } });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
function harness(overrides: Partial<IgDemoConnectionOptions> = {}) {
  let tick = Date.parse("2026-10-19T19:00:00Z");
  let access = { ownerId: owner, premium: true, optedIn: true };
  const calls: { url: string; init?: RequestInit }[] = [];
  let handler: ((url: string, init?: RequestInit) => Response | Promise<Response>) | undefined;
  const transport: typeof fetch = async (url, init) => {
    const path = String(url);
    calls.push({ url: path, init });
    assert.equal(new URL(path).origin, "https://demo-api.ig.com");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.credentials, "omit");
    if (handler) return handler(path, init);
    if (init?.method === "POST") return json({ currentAccountId: "DEMO1", reroutingEnvironment: "DEMO" }, { CST: "mock-cst", "X-SECURITY-TOKEN": "mock-token" });
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    if (path.endsWith("/session")) return json({ accountId: "DEMO1", currency: "GBP", clientId: "mock-client" });
    if (path.endsWith("/accounts")) return json({ accounts: [account] });
    if (path.endsWith("/positions")) return json({ positions: [position] });
    throw Error("unexpected mock path");
  };
  const options: IgDemoConnectionOptions = {
    ownerId: owner, apiKey: "mock-only-api-key", transport,
    authorise: async () => access, reserveRequest: async () => true,
    featureEnabled: true, igCommercialApproval: true, accountPositionDisplayRights: true, now: () => tick,
    ...overrides,
  };
  const connection = createIgDemoConnection(options);
  return {
    connection, calls, options,
    time: (value: number) => { tick += value; },
    access: (value: typeof access) => { access = value; },
    handler: (value?: typeof handler) => { handler = value; },
  };
}

test("IG panel flag defaults OFF and missing policy never reaches broker", async () => {
  assert.equal(IG_DEMO_PANEL_ENABLED_BY_DEFAULT, false);
  for (const flag of ["featureEnabled", "igCommercialApproval", "accountPositionDisplayRights"] as const) {
    const h = harness({ [flag]: undefined });
    await assert.rejects(h.connection.connect(input), /IG_DEMO_(DISABLED|COMMERCIAL_APPROVAL_REQUIRED)/);
    assert.equal(h.calls.length, 0);
  }
});

test("strict owner UUID and browser factory reject without provider call", () => {
  assert.throws(() => harness({ ownerId: "user@example.com" }), /IG_DEMO_OWNER_REQUIRED/);
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  try { assert.throws(() => harness(), /IG_DEMO_SERVER_ONLY/); }
  finally { Reflect.deleteProperty(globalThis, "window"); }
});

test("connect authenticates only on fixed session POST and proves current account with GET", async () => {
  const h = harness();
  const result = await h.connection.connect(input);
  assert.deepEqual(Object.keys(h.connection).sort(), ["connect", "disconnect", "snapshot", "state"]);
  assert.match(result.connectionId, /^[a-f0-9-]{36}$/);
  assert.deepEqual(result, { environment: "DEMO", connectionId: h.connection.state().connectionId, status: "CONNECTED", generation: 1 });
  assert.deepEqual(h.calls.map(({ url, init }) => [new URL(url).pathname, init?.method]), [
    ["/gateway/deal/session", "POST"], ["/gateway/deal/session", "GET"], ["/gateway/deal/accounts", "GET"],
  ]);
  assert.deepEqual(JSON.parse(String(h.calls[0].init?.body)), { identifier: input.identifier, password: input.password, encryptedPassword: false });
  assert.equal(new Headers(h.calls[0].init?.headers).has("CST"), false);
  assert.equal(new Headers(h.calls[1].init?.headers).get("CST"), "mock-cst");
  assert.equal(JSON.stringify(result).includes("mock"), false);
  assert.equal(JSON.stringify(h.connection).includes("mock"), false);
});

test("positions require before/after current account proof and redact raw provider quotes/secrets", async () => {
  const h = harness();
  await h.connection.connect(input);
  h.calls.length = 0;
  const result = await h.connection.snapshot(chart);
  assert.deepEqual(h.calls.map(({ url }) => new URL(url).pathname), ["/gateway/deal/session", "/gateway/deal/accounts", "/gateway/deal/positions", "/gateway/deal/session"]);
  assert.equal(result.environment, "DEMO");
  assert.equal(result.positions[0].chartContext, "EXACT_IG_PRODUCT");
  assert.equal(result.riskContext, "HOLD_MARKET_SPEC_UNVERIFIED");
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.positions[0]), true);
  const serialized = JSON.stringify(result);
  for (const forbidden of ["mock", "bid", "offer", "clientId", "securityToken", "apiKey", "password"]) assert.equal(serialized.includes(forbidden), false);
});

test("account mismatch at login or session proof never establishes ownership", async () => {
  for (const where of ["login", "proof"]) {
    const h = harness();
    h.handler((_url, init) => init?.method === "POST"
      ? json({ currentAccountId: where === "login" ? "OTHER" : "DEMO1" }, { CST: "mock-cst", "X-SECURITY-TOKEN": "mock-token" })
      : json({ accountId: "OTHER" }));
    await assert.rejects(h.connection.connect(input), /IG_DEMO_ACCOUNT_MISMATCH/);
    assert.equal(h.connection.state().status, "DISCONNECTED");
  }
});

test("rerouting metadata can never redirect to a different environment", async () => {
  for (const reroutingEnvironment of ["LIVE", "TEST", "UAT", "", null]) {
    const h = harness();
    h.handler(() => json({ currentAccountId: "DEMO1", reroutingEnvironment }, { CST: "mock-cst", "X-SECURITY-TOKEN": "mock-token" }));
    await assert.rejects(h.connection.connect(input), /IG_DEMO_ENVIRONMENT_MISMATCH/);
    assert.equal(h.calls.length, 1);
  }
});

test("missing tokens, malformed login and unsafe login inputs fail without exposed provider content", async () => {
  for (const body of [{ currentAccountId: "DEMO1" }, { currentAccountId: "private secret" }]) {
    const h = harness(); h.handler(() => json(body));
    await assert.rejects(h.connection.connect(input), /IG_DEMO_(INVALID_SESSION|UNEXPECTED_RESPONSE_CONTRACT)/);
  }
  for (const invalid of [{ ...input, password: "x\nprivate" }, { ...input, identifier: "private user" }, { ...input, password: "x".repeat(351) }]) {
    const h = harness();
    await assert.rejects(h.connection.connect(invalid), /IG_DEMO_INVALID_LOGIN_INPUT/);
    assert.equal(h.calls.length, 0);
  }
});

test("premium and explicit opt-in are required; changing authenticated owner clears session", async () => {
  for (const change of [{ ownerId: other, premium: true, optedIn: true }, { ownerId: owner, premium: false, optedIn: true }, { ownerId: owner, premium: true, optedIn: false }]) {
    const h = harness(); await h.connection.connect(input); h.calls.length = 0;
    h.access(change);
    await assert.rejects(h.connection.snapshot(chart), /IG_DEMO_(OWNER_MISMATCH|OPT_IN_PREMIUM_REQUIRED)/);
    assert.equal(h.calls.length, 0);
    assert.equal(h.connection.state().status, "REVOKED");
  }
});

test("two owner instances and token headers remain isolated", async () => {
  const a = harness();
  const b = harness({ ownerId: other, authorise: async () => ({ ownerId: other, premium: true, optedIn: true }), apiKey: "second-mock-key" });
  await Promise.all([a.connection.connect(input), b.connection.connect(input)]);
  assert.equal(new Headers(a.calls[0].init?.headers).get("X-IG-API-KEY"), "mock-only-api-key");
  assert.equal(new Headers(b.calls[0].init?.headers).get("X-IG-API-KEY"), "second-mock-key");
  await a.connection.disconnect();
  assert.equal(b.connection.state().status, "CONNECTED");
  assert.equal((await b.connection.snapshot()).positions.length, 1);
});

test("conservative local expiry revokes before network and reconnect never happens silently", async () => {
  const h = harness(); await h.connection.connect(input); h.calls.length = 0;
  h.time(300_000);
  await assert.rejects(h.connection.snapshot(chart), /IG_DEMO_SESSION_EXPIRED/);
  assert.equal(h.connection.state().status, "EXPIRED");
  assert.equal(h.calls.length, 0);
});

test("an account switch after positions rejects all data and revokes the local connection", async () => {
  const h = harness(); await h.connection.connect(input);
  let proofs = 0;
  h.handler((url) => {
    if (url.endsWith("/session")) return json({ accountId: ++proofs === 1 ? "DEMO1" : "OTHER" });
    if (url.endsWith("/accounts")) return json({ accounts: [account] });
    return json({ positions: [position] });
  });
  await assert.rejects(h.connection.snapshot(chart), /IG_DEMO_ACCOUNT_MISMATCH/);
  assert.equal(h.connection.state().status, "REVOKED");
});

test("HTTP 401/403 revoke, 5xx never becomes empty positions and no retry is attempted", async () => {
  for (const status of [401, 403, 500, 503]) {
    const h = harness(); await h.connection.connect(input); h.calls.length = 0;
    h.handler(() => new Response("private token", { status }));
    await assert.rejects(h.connection.snapshot(chart), { message: `IG_DEMO_HTTP_${status}` });
    assert.equal(h.calls.length, 1);
    assert.equal(h.connection.state().status, status < 500 ? "REVOKED" : "CONNECTED");
  }
});

test("429 imposes a local cooldown without auto-retry or inferred empty portfolio", async () => {
  const h = harness(); await h.connection.connect(input); h.calls.length = 0;
  h.handler(() => new Response("private token", { status: 429 }));
  await assert.rejects(h.connection.snapshot(), /IG_DEMO_HTTP_429/);
  await assert.rejects(h.connection.snapshot(), /IG_DEMO_RATE_LIMITED/);
  assert.equal(h.calls.length, 1);
});

test("shared quota authority denial or failure prevents all requests", async () => {
  for (const reserveRequest of [async () => false, async () => { throw Error("private token"); }]) {
    const h = harness({ reserveRequest });
    await assert.rejects(h.connection.connect(input), /IG_DEMO_(RATE_LIMITED|BUDGET_UNAVAILABLE)/);
    assert.equal(h.calls.length, 0);
  }
});

test("pre-cancelled read does not poison the next read and makes no HTTP call", async () => {
  const h = harness(); await h.connection.connect(input); h.calls.length = 0;
  const controller = new AbortController(); controller.abort("private token");
  await assert.rejects(h.connection.snapshot(chart, controller.signal), /IG_DEMO_CANCELLED/);
  assert.equal(h.calls.length, 0);
  assert.equal((await h.connection.snapshot(chart)).positions.length, 1);
});

test("disconnect aborts an uncooperative in-flight read; late success cannot resurrect state", async () => {
  const h = harness(); await h.connection.connect(input);
  const stalled = deferred<Response>(); const started = deferred<void>();
  h.handler((_url, init) => {
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    started.resolve(); return stalled.promise;
  });
  const read = h.connection.snapshot(chart);
  const rejected = assert.rejects(read, { message: "IG_DEMO_CANCELLED" });
  await started.promise;
  const logout = await h.connection.disconnect();
  assert.equal(logout.providerLogout, "CONFIRMED");
  await rejected;
  stalled.resolve(json({ accountId: "DEMO1" }));
  await Promise.resolve();
  assert.equal(h.connection.state().status, "REVOKED");
});

test("cancelled login with an uncooperative fetch cannot commit a late session", async () => {
  const h = harness(); const stalled = deferred<Response>(); const started = deferred<void>();
  const abort = new AbortController();
  h.handler(() => { started.resolve(); return stalled.promise; });
  const login = h.connection.connect(input, abort.signal);
  const rejected = assert.rejects(login, /IG_DEMO_CANCELLED/);
  await started.promise; abort.abort("private token"); await rejected;
  stalled.resolve(json({ currentAccountId: "DEMO1" }, { CST: "mock-cst", "X-SECURITY-TOKEN": "mock-token" }));
  await Promise.resolve();
  assert.equal(h.connection.state().status, "DISCONNECTED");
});

test("duplicate snapshot request is rejected instead of racing provider reads", async () => {
  const h = harness(); await h.connection.connect(input);
  const stalled = deferred<Response>(); const started = deferred<void>();
  h.handler(() => { started.resolve(); return stalled.promise; });
  const abort = new AbortController();
  const first = h.connection.snapshot(chart, abort.signal);
  const rejected = assert.rejects(first, /IG_DEMO_CANCELLED/);
  await started.promise;
  await assert.rejects(h.connection.snapshot(chart), /IG_DEMO_REQUEST_IN_PROGRESS/);
  abort.abort(); await rejected;
});

test("local disconnect is final even when provider logout fails or is already cancelled", async () => {
  for (const cancelled of [false, true]) {
    const h = harness(); await h.connection.connect(input); h.calls.length = 0;
    h.handler(() => { throw Error("private-token"); });
    const abort = new AbortController(); if (cancelled) abort.abort();
    const result = await h.connection.disconnect(abort.signal);
    assert.equal(result.providerLogout, "UNCONFIRMED");
    assert.equal(h.connection.state().status, "REVOKED");
    assert.equal(h.calls.length, cancelled ? 0 : 1);
    assert.equal(JSON.stringify(result).includes("private"), false);
  }
});

test("withdrawing premium or consent still permits explicit local disconnect", async () => {
  const h = harness(); await h.connection.connect(input);
  h.access({ ownerId: owner, premium: false, optedIn: false });
  assert.equal((await h.connection.disconnect()).status, "REVOKED");
});

test("no label-based equivalence between IG CFD, spread bet, cash SPX and ES futures", () => {
  assert.equal(igDemoChartContext(chart.epic, "CFD", chart), "EXACT_IG_PRODUCT");
  assert.equal(igDemoChartContext(chart.epic, "SPREADBET", chart), "HOLD_DIFFERENT_PRODUCT");
  for (const epic of ["ES", "SPX", "US500"]) assert.equal(igDemoChartContext(epic, "CFD", chart), "HOLD_DIFFERENT_PRODUCT");
  assert.equal(igDemoChartContext(chart.epic, "CFD", undefined), "HOLD_CHART_IDENTITY");
  assert.equal(igDemoChartContext(chart.epic, "CFD", { ...chart, source: "IG" } as never), "HOLD_CHART_IDENTITY");
});

test("arbitrary transport exceptions cannot masquerade as trusted error codes or leak token-looking strings", async () => {
  for (const message of ["IG_DEMO_PRIVATE_TOKEN", "mock-only-password", "X-SECURITY-TOKEN mock-secret"]) {
    const h = harness(); h.handler(() => { throw Error(message); });
    await assert.rejects(h.connection.connect(input), { message: "IG_DEMO_TRANSPORT_UNAVAILABLE" });
  }
});

test("malformed or duplicate position payloads never become a successful or empty panel", async () => {
  for (const raw of [{}, { positions: [position, position] }, { positions: [{ ...position, position: { ...position.position, size: 0 } }] }]) {
    const h = harness(); await h.connection.connect(input);
    h.handler((url) => url.endsWith("/session") ? json({ accountId: "DEMO1" }) : url.endsWith("/accounts") ? json({ accounts: [account] }) : json(raw));
    await assert.rejects(h.connection.snapshot(chart), { message: "IG_DEMO_UNEXPECTED_RESPONSE_CONTRACT" });
  }
});

test("a superseded login cannot overwrite a newer successful generation", async () => {
  const h = harness(); const stalled = deferred<Response>(); const started = deferred<void>();
  let first = true;
  h.handler((_url, init) => {
    if (init?.method === "POST" && first) { first = false; started.resolve(); return stalled.promise; }
    if (init?.method === "POST") return json({ currentAccountId: "DEMO1" }, { CST: "new-mock-cst", "X-SECURITY-TOKEN": "new-mock-token" });
    if (_url.endsWith("/session")) return json({ accountId: "DEMO1" });
    return json({ accounts: [account] });
  });
  const old = h.connection.connect(input);
  const rejected = assert.rejects(old, { message: "IG_DEMO_SUPERSEDED" });
  await started.promise;
  const newer = await h.connection.connect(input);
  await rejected;
  stalled.resolve(json({ currentAccountId: "OTHER" }, { CST: "old-mock-cst", "X-SECURITY-TOKEN": "old-mock-token" }));
  await Promise.resolve();
  assert.equal(h.connection.state().generation, newer.generation);
  assert.equal(h.connection.state().status, "CONNECTED");
});

test("owner logout during a response discards data and revokes tokens before return", async () => {
  const h = harness(); await h.connection.connect(input);
  h.handler((url) => {
    if (url.endsWith("/session")) return json({ accountId: "DEMO1" });
    if (url.endsWith("/accounts")) return json({ accounts: [account] });
    h.access({ ownerId: other, premium: true, optedIn: true });
    return json({ positions: [position] });
  });
  await assert.rejects(h.connection.snapshot(chart), { message: "IG_DEMO_OWNER_MISMATCH" });
  assert.equal(h.connection.state().status, "REVOKED");
});

test("disconnect supersedes a connect still awaiting owner authorisation without any broker request", async () => {
  const pending = deferred<{ ownerId: string; premium: boolean; optedIn: boolean }>();
  const started = deferred<void>();
  const h = harness({ authorise: async () => { started.resolve(); return pending.promise; } });
  const login = h.connection.connect(input);
  const rejected = assert.rejects(login, { message: "IG_DEMO_SUPERSEDED" });
  await started.promise;
  assert.equal((await h.connection.disconnect()).status, "REVOKED");
  await rejected;
  pending.resolve({ ownerId: owner, premium: true, optedIn: true });
  await new Promise<void>((r) => setImmediate(r));
  assert.equal(h.connection.state().status, "REVOKED");
  assert.equal(h.calls.length, 0);
});

test("disconnect supersedes a connect waiting on shared quota and late quota approval cannot send login", async () => {
  const pending = deferred<boolean>(); const started = deferred<void>();
  const h = harness({ reserveRequest: async () => { started.resolve(); return pending.promise; } });
  const login = h.connection.connect(input);
  const rejected = assert.rejects(login, { message: "IG_DEMO_SUPERSEDED" });
  await started.promise; await h.connection.disconnect(); await rejected;
  pending.resolve(true); await new Promise<void>((r) => setImmediate(r));
  assert.equal(h.calls.length, 0);
  assert.equal(h.connection.state().status, "REVOKED");
});

test("external cancellation bounds both slow authorisation and slow quota before transport", async () => {
  for (const phase of ["auth", "quota"]) {
    const started = deferred<void>(); const pending = deferred<never>();
    const h = harness(phase === "auth"
      ? { authorise: async () => { started.resolve(); return pending.promise; } }
      : { reserveRequest: async () => { started.resolve(); return pending.promise; } });
    const abort = new AbortController();
    let settled = false;
    const login = h.connection.connect(input, abort.signal).catch((error: unknown) => { settled = true; throw error; });
    const rejected = assert.rejects(login, { message: "IG_DEMO_CANCELLED" });
    await started.promise; abort.abort("private");
    await new Promise<void>((r) => setImmediate(r));
    assert.equal(settled, true);
    await rejected;
    assert.equal(h.calls.length, 0);
  }
});

test("late disconnect authorisation cannot log out or revoke a newer connection", async () => {
  const pending = deferred<{ ownerId: string; premium: boolean; optedIn: boolean }>(); const started = deferred<void>();
  let stallNext = false;
  const h = harness({ authorise: async () => {
    if (stallNext) { stallNext = false; started.resolve(); return pending.promise; }
    return { ownerId: owner, premium: true, optedIn: true };
  } });
  await h.connection.connect(input); h.calls.length = 0;
  stallNext = true;
  const disconnect = h.connection.disconnect();
  assert.equal(h.connection.state().status, "REVOKED", "local revocation occurs at invocation");
  await started.promise;
  const newer = await h.connection.connect(input);
  assert.equal((await disconnect).providerLogout, "UNCONFIRMED");
  pending.resolve({ ownerId: owner, premium: true, optedIn: true });
  await new Promise<void>((r) => setImmediate(r));
  assert.equal(h.connection.state().generation, newer.generation);
  assert.equal(h.connection.state().status, "CONNECTED");
  assert.equal(h.calls.some(({ init }) => init?.method === "DELETE"), false);
});
