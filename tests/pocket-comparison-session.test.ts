import assert from "node:assert/strict";
import test from "node:test";
import { createScreenshotComparison, type ComparisonState } from "../app/pocket/screenshot-comparison-session.ts";

const file = (name: string) => ({ name, type: "image/png", size: 100 });
const image = (name: string) => `data:image/png;base64,${name}`;
const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
type Result = { symbol: string };
const reply = (symbol: string) => new Response(JSON.stringify({ result: { symbol } }));
function harness(overrides: Partial<Parameters<typeof createScreenshotComparison<Result>>[0]> = {}) {
  const states: ComparisonState<Result>[] = [];
  const requests: RequestInit[] = [];
  const session = createScreenshotComparison<Result>({
    endpoint: "/api/pocket/optional-test", failureMessage: "Check unavailable",
    publish: state => states.push(state), read: async f => image(f.name),
    validate: (v): v is Result => Boolean(v && typeof v === "object" && "symbol" in v && typeof v.symbol === "string"),
    fetch: async (_url, init) => { requests.push(init); return reply("AAPL"); }, ...overrides,
  });
  return { session, states, requests, latest: () => states.at(-1)! };
}

test("a successful check submits the exact chosen image/context and clears loading", async () => {
  const h = harness(); await h.session.attach(file("chart"));
  await h.session.check({ ticker: "AAPL", levels: [200] });
  assert.deepEqual(JSON.parse(String(h.requests[0].body)), { image: image("chart"), ticker: "AAPL", levels: [200] });
  assert.equal(h.latest().result?.symbol, "AAPL"); assert.equal(h.latest().busy, false);
});
test("out-of-order file readers retain only the last selected screenshot", async () => {
  const a = deferred<string>(), b = deferred<string>(); const signals: AbortSignal[] = [];
  const h = harness({ read: (f, signal) => { signals.push(signal); return f.name === "first" ? a.promise : b.promise; } });
  const old = h.session.attach(file("first")); const fresh = h.session.attach(file("second"));
  assert.equal(signals[0].aborted, true); b.resolve(image("second")); await fresh; a.resolve(image("first")); await old;
  assert.equal(h.latest().image, image("second")); assert.equal(h.latest().fileName, "second");
});
test("replacing a screenshot aborts an old check and ignores a provider that returns anyway", async () => {
  const response = deferred<Response>(); let signal!: AbortSignal;
  const h = harness({ fetch: async (_url, init) => { signal = init.signal as AbortSignal; return response.promise; } });
  await h.session.attach(file("first")); const checking = h.session.check({ ticker: "AAPL" });
  await h.session.attach(file("second")); assert.equal(signal.aborted, true);
  response.resolve(reply("AAPL")); await checking;
  assert.equal(h.latest().result, null); assert.equal(h.latest().image, image("second")); assert.equal(h.latest().busy, false);
});
test("changing chart context disposes the old session before its reply can publish", async () => {
  const response = deferred<Response>(); const old = harness({ fetch: async () => response.promise });
  await old.session.attach(file("old")); const checking = old.session.check({ ticker: "AAPL" });
  old.session.dispose(); const writes = old.states.length;
  const current = harness(); await current.session.attach(file("new"));
  response.resolve(reply("AAPL")); await checking;
  assert.equal(old.states.length, writes); assert.equal(current.latest().result, null); assert.equal(current.latest().fileName, "new");
});
test("cancel during response decoding ignores the old body and allows a fresh check", async () => {
  const body = deferred<unknown>(); let calls = 0;
  const h = harness({ fetch: async () => ++calls === 1 ? { ok: true, json: () => body.promise } as Response : reply("MSFT") });
  await h.session.attach(file("chart")); const checking = h.session.check({ ticker: "AAPL" }); await Promise.resolve();
  h.session.cancel(); await h.session.check({ ticker: "MSFT" });
  body.resolve({ result: { symbol: "AAPL" } }); await checking;
  assert.equal(h.latest().result?.symbol, "MSFT"); assert.equal(h.latest().error, ""); assert.equal(h.latest().busy, false);
});
test("a stale failure/finally cannot overwrite the state of a newer active request", async () => {
  const old = deferred<Response>(), current = deferred<Response>(); let calls = 0;
  const h = harness({ fetch: () => ++calls === 1 ? old.promise : current.promise });
  await h.session.attach(file("first")); const a = h.session.check({ ticker: "AAPL" });
  await h.session.attach(file("second")); const b = h.session.check({ ticker: "MSFT" });
  old.reject(new Error("stale failure")); await a;
  assert.equal(h.latest().busy, true); assert.equal(h.latest().error, "");
  current.resolve(reply("MSFT")); await b; assert.equal(h.latest().result?.symbol, "MSFT");
});
test("repeated clicks issue one request while a check is active", async () => {
  const response = deferred<Response>(); let calls = 0;
  const h = harness({ fetch: async () => { calls++; return response.promise; } });
  await h.session.attach(file("chart")); const a = h.session.check({ ticker: "AAPL" });
  await h.session.check({ ticker: "AAPL" }); assert.equal(calls, 1);
  response.resolve(reply("AAPL")); await a;
});
test("invalid, empty or oversized replacements clear the old screenshot and make no request", async () => {
  for (const invalid of [{ ...file("empty"), size: 0 }, { ...file("large"), size: 8 * 1024 * 1024 + 1 }, { ...file("type"), type: "text/plain" }]) {
    const h = harness(); await h.session.attach(file("valid")); await h.session.attach(invalid); await h.session.check({});
    assert.equal(h.latest().image, ""); assert.equal(h.latest().fileName, ""); assert.match(h.latest().error, /JPEG/); assert.equal(h.requests.length, 0);
  }
});
test("cancelled image reads and unmounted checks cannot resurrect their state", async () => {
  const read = deferred<string>(); const h = harness({ read: () => read.promise });
  const attaching = h.session.attach(file("chart")); h.session.cancel(); read.resolve(image("chart")); await attaching;
  assert.equal(h.latest().image, ""); assert.equal(h.latest().reading, false);
  h.session.dispose(); const count = h.states.length; await h.session.attach(file("other")); await h.session.check({}); h.session.cancel();
  assert.equal(h.states.length, count); assert.equal(h.requests.length, 0);
});

test("malformed successful JSON becomes a recoverable error instead of a render crash", async () => {
  for (const payload of [null, [], {}, { result: "unexpected" }, { result: {} }, { result: { symbol: 12 } }]) {
    const h = harness({ fetch: async () => new Response(JSON.stringify(payload)) });
    await h.session.attach(file("chart")); await h.session.check({ ticker: "AAPL" });
    assert.equal(h.latest().result, null); assert.equal(h.latest().busy, false); assert.equal(h.latest().error, "Check unavailable");
  }
});
