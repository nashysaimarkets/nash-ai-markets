import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import OpenAI from "openai";
import { classifyOpenAIFailure } from "../app/lib/server/openai";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../app/lib/server/bounded-json-body";
import { pocketImageContent, validatePocketImages } from "../app/pocket/chart-images";

function route(fetch: typeof globalThis.fetch) {
  const source = fs.readFileSync(new URL("../app/api/pocket/preflight/route.ts", import.meta.url), "utf8").replace(/^import .*;\n/gm, "").replace(/^export /gm, "");
  let released = 0;
  const context = vm.createContext({
    Request, Response, AbortSignal, AbortController, setTimeout, clearTimeout, Date, process: { env: {} },
    console: { info() {}, warn() {} },
    pocketImageContent, validatePocketImages, readBoundedJsonBody, RequestBodyTooLargeError, classifyOpenAIFailure,
    NextResponse: { json: Response.json }, rejectCrossOrigin: () => null,
    pocketBudgetHeaders: () => ({}), takePocketBudget: () => ({ allowed: true, release: () => released++ }),
    OPENAI_DEFAULT_MODEL: "test-model",
    createOpenAIClient: () => new OpenAI({ apiKey: "test-only", maxRetries: 0, fetch }),
  });
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { post: context.POST as (request: Request) => Promise<Response>, released: () => released };
}
const request = (signal?: AbortSignal) => new Request("https://test.invalid/api/pocket/preflight", {
  method: "POST", signal, headers: { "content-type": "application/json" },
  body: JSON.stringify({ image: "data:image/png;base64,YQ==", contextImage: "data:image/png;base64,Yg==" }),
});
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test("preflight bounds a provider body that stalls after HTTP headers and releases failed allowance", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
  let providerSignal: AbortSignal | undefined;
  const harness = route(async (_url, init) => {
    providerSignal = init?.signal as AbortSignal;
    return new Response(new ReadableStream({ start(controller) {
      providerSignal!.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
    } }), { headers: { "content-type": "application/json" } });
  });
  const response = harness.post(request()); await flush();
  assert.ok(providerSignal); assert.equal(providerSignal.aborted, false);
  t.mock.timers.tick(25000);
  assert.equal((await response).status, 503); assert.equal(providerSignal.aborted, true); assert.equal(harness.released(), 1);
});

test("replacing an upload cancels its running provider request without starting another attempt", async () => {
  const upload = new AbortController(); let calls = 0, cancelled = false;
  const harness = route(async (_url, init) => {
    calls++;
    return new Response(new ReadableStream({ start(controller) {
      init?.signal?.addEventListener("abort", () => { cancelled = true; controller.error(new DOMException("Aborted", "AbortError")); }, { once: true });
    } }), { headers: { "content-type": "application/json" } });
  });
  const response = harness.post(request(upload.signal)); await flush(); upload.abort();
  assert.equal((await response).status, 503); assert.equal(cancelled, true); assert.equal(calls, 1);
});

test("a complete preflight retains both charts, strict evidence checks and confirmed-mismatch rejection", async () => {
  let body: Record<string, unknown> = {};
  const harness = route(async (_url, init) => {
    body = JSON.parse(String(init?.body));
    const output_text = JSON.stringify({ status: "READY", sameInstrument: false, timeframeChecks: [{slot: "PRIMARY", detected: "5m"}, {slot: "HIGHER_TIMEFRAME", detected: "1h"}] });
    return Response.json({ id: "test", status: "completed", output_text, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: output_text }] }] });
  });
  const response = await harness.post(request());
  assert.equal(response.status, 200); assert.equal((await response.json()).preflight.status, "RETAKE");
  const input = body.input as Array<{ content: Array<{ type: string }> }>;
  assert.equal(input[0].content.filter(item => item.type === "input_image").length, 2);
  assert.equal((body.text as { format: { strict: boolean } }).format.strict, true);
  assert.equal(harness.released(), 0);
});
