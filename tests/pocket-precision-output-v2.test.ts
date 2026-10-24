/** Offline tests of the actual route slices. Every request and response here is synthetic. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { recoverPrecisionGeometry } from "../app/api/pocket/precision-fallback.ts";
import { verifyPocketBenchmarkEnvelope } from "../app/api/pocket/torture/provider-spend.ts";

const route = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
const slice = (start: string, end: string) => {
  const from = route.indexOf(start), to = route.indexOf(end, from);
  assert.ok(from >= 0 && to > from);
  return route.slice(from, to);
};
const make = new Function("model", "process", "client", "dispatchPocketAnalysisProviderCall", "recoverPrecisionGeometry", "console",
  stripTypeScriptTypes(slice("const schema =", "export async function POST")
    + slice("    const precisionInstructions =", "    const [response, precisionResult"))
  + "\nreturn { requestPrecision, safePrecision };");
const merge = new Function("initial", "precisionResult", "recoverPrecisionGeometry",
  stripTypeScriptTypes("let analysis = initial, contextPrecisionResult = null, chartConfirmation = null;\n"
    + slice('    if (analysis && typeof analysis === "object")', "    const calibrated = calibratePocketAnalysis"))
  + "\nreturn analysis;");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const parseMain = new AsyncFunction("analysisRequest", "safePrecision",
  "const image = 'synthetic', precisionImage = null, contextImage = null, contextPrecisionImage = null;\n"
  + stripTypeScriptTypes(slice("    const [response, precisionResult, contextPrecisionResult]", '    if (analysis && typeof analysis === "object")'))
  + "\nreturn analysis;");
const model = "gpt-5-mini-2025-08-07";
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const precision = {
  plotBounds: { left: 8, top: 10, right: 90, bottom: 90 },
  priceScaleAnchors: [{ price: 120, y: 10 }, { price: 110, y: 30 }, { price: 90, y: 70 }, { price: 80, y: 90 }],
  levels: [
    { kind: "support", label: "Lower shelf", price: "95", x: 8, y: 60, x2: 90, y2: 60 },
    { kind: "support", label: "Range floor", price: "90", x: 8, y: 70, x2: 90, y2: 70 },
    { kind: "resistance", label: "Upper shelf", price: "105", x: 8, y: 40, x2: 90, y2: 40 },
    { kind: "resistance", label: "Range ceiling", price: "110", x: 8, y: 30, x2: 90, y2: 30 },
    { kind: "pivot", label: "Swing low", price: "92", x: 25, y: 66, x2: 25, y2: 66 },
    { kind: "pivot", label: "Swing high", price: "108", x: 50, y: 34, x2: 50, y2: 34 },
    { kind: "pivot", label: "Lower swing", price: "89", x: 75, y: 72, x2: 75, y2: 72 },
    { kind: "zone", label: "Repeated reaction", price: "90", x: 40, y: 68, x2: 60, y2: 72 },
  ],
  currentPrice: "100", confidence: "MEDIUM", limitation: "Synthetic structured-output fixture; no chart accuracy claim.",
};
const completed = (data = precision) => ({ status: "completed", output_text: JSON.stringify(data) });
const missingSide = () => completed({ ...precision, levels: precision.levels.filter(level => Number(level.price) < 100) });
function harness(responses: unknown[]) {
  const calls: { slot: string; envelope: Record<string, unknown> }[] = [], errors: unknown[][] = [];
  const client = { responses: { create: async () => {
    assert.ok(responses.length, "Unexpected extra provider call");
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response;
  } } };
  const dispatch = (slot: string, envelope: Record<string, unknown>, send: () => Promise<unknown>) => {
    calls.push({ slot, envelope: structuredClone(envelope) }); return send();
  };
  return { ...make(model, { env: {} }, client, dispatch, recoverPrecisionGeometry, { error: (...args: unknown[]) => errors.push(args) }), calls, errors };
}

test("the shared production builder caps primary and rescue at 4000 and retains strict JSON", async () => {
  const h = harness([completed(), completed()]);
  await h.requestPrecision(image); await h.requestPrecision(image, true, image);
  assert.deepEqual(h.calls.map(({ slot }: { slot: string }) => slot), ["primary_precision", "rescue_precision"]);
  for (const { envelope } of h.calls) {
    assert.equal(envelope.model, model); assert.equal(envelope.max_output_tokens, 4000);
    assert.equal(envelope.service_tier, "default"); assert.equal(envelope.store, false);
    assert.deepEqual(envelope.reasoning, { effort: "low" });
    assert.equal(envelope.text.format.type, "json_schema"); assert.equal(envelope.text.format.strict, true);
    assert.equal(envelope.text.format.schema.additionalProperties, false);
    assert.deepEqual(Object.keys(precision).sort(), [...envelope.text.format.schema.required].sort());
    assert.equal(precision.levels.length, envelope.text.format.schema.properties.levels.maxItems);
    assert.equal(precision.priceScaleAnchors.length, envelope.text.format.schema.properties.priceScaleAnchors.maxItems);
  }
  assert.equal(h.calls[0].envelope.input[0].content.length, 2);
  assert.equal(h.calls[1].envelope.input[0].content.length, 3);
  assert.match(slice("    const analysisEnvelope:", "    const analysisRequest ="), /max_output_tokens: 7000/);
});

test("completed representative precision is returned unchanged without a rescue", async () => {
  const first = completed(), before = structuredClone(first), h = harness([first]);
  assert.equal(await h.safePrecision(image, "synthetic", null), first);
  assert.deepEqual(first, before); assert.equal(h.calls.length, 1);
});

test("truncated precision is not repaired and does not trigger a new retry", async () => {
  const first = { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output_text: '{"plotBounds":' };
  const before = structuredClone(first), h = harness([first]);
  assert.equal(await h.safePrecision(image, "synthetic", null), null);
  assert.equal(h.calls.length, 1); assert.deepEqual(first, before);
});

test("non-completed primary is rejected even when its text is syntactically complete JSON", async () => {
  for (const status of ["incomplete", "failed", "cancelled", undefined]) {
    const h = harness([{ ...completed(), status }]);
    assert.equal(await h.safePrecision(image, "synthetic", null), null); assert.equal(h.calls.length, 1);
  }
});

test("completed missing-side primary preserves the existing one-rescue path", async () => {
  const h = harness([missingSide(), completed()]);
  const result = await h.safePrecision(image, "synthetic", image);
  const parsed = JSON.parse(result.output_text);
  assert.deepEqual(h.calls.map(({ slot }: { slot: string }) => slot), ["primary_precision", "rescue_precision"]);
  assert.ok(parsed.levels.some((level: { price: string }) => Number(level.price) > 100));
  assert.ok(parsed.levels.some((level: { price: string }) => Number(level.price) < 100));
  assert.equal("status" in result, false, "Merged geometry must not impersonate a completed provider receipt");
});

test("an incomplete rescue cannot overwrite the completed primary or trigger a further call", async () => {
  for (const output_text of ['{"plotBounds":', JSON.stringify(precision)]) {
    const first = missingSide(), rescue = { ...completed(), status: "incomplete", output_text }, before = structuredClone(rescue);
    const h = harness([first, rescue]);
    assert.equal(await h.safePrecision(image, "synthetic", image), first);
    assert.equal(h.calls.length, 2); assert.deepEqual(rescue, before);
  }
});

test("malformed completed JSON remains rejected by the actual downstream geometry path", async () => {
  const first = { status: "completed", output_text: '{"levels":' }, h = harness([first]);
  const result = await h.safePrecision(image, "synthetic", null);
  const analysis = merge({ levels: [], priceScaleAnchors: [] }, result, recoverPrecisionGeometry);
  assert.deepEqual(analysis.levels, []); assert.deepEqual(analysis.priceScaleAnchors, []); assert.equal(h.calls.length, 1);
});

test("transport failure returns unavailable precision after one attempt", async () => {
  const h = harness([new Error("synthetic transport failure")]);
  assert.equal(await h.safePrecision(image, "synthetic", null), null);
  assert.equal(h.calls.length, 1); assert.equal(h.errors.length, 1);
});

test("only an actually completed main response can become an analysis, even with valid JSON", async () => {
  const report = { summary: "Synthetic main completion contract" };
  for (const status of ["incomplete", "failed", "cancelled", undefined]) {
    const response = { status, output_text: JSON.stringify(report) }, before = structuredClone(response);
    await assert.rejects(parseMain(Promise.resolve(response), async () => null), /not completed/);
    assert.deepEqual(response, before);
  }
  assert.deepEqual(await parseMain(Promise.resolve({ status: "completed", output_text: JSON.stringify(report) }), async () => null), report);
});

test("the unchanged envelope validator rejects v2 under 1400 and accepts only the matching 4000 plan", async () => {
  const h = harness([completed(), completed()]);
  await h.requestPrecision(image); await h.requestPrecision(image, true, image);
  for (const { slot, envelope } of h.calls) {
    const call = { slot, model, serviceTier: "default", maxOutputTokens: 1400, maxInputTextChars: 30000,
      maxSchemaBytes: 30000, maxImages: 2, maxImageBytes: 4000000, maxImageWidth: 4096, maxImageHeight: 4096,
      maxImagePixels: 16777216, maxCostMicroUsd: 102800, costBoundEvidenceRef: "synthetic-old-bound" };
    assert.throws(() => verifyPocketBenchmarkEnvelope(slot, envelope, { plan: { [slot]: call } } as never), /planned model\/output bound/);
    const revised = { ...call, maxOutputTokens: 4000, maxCostMicroUsd: 108000, costBoundEvidenceRef: "synthetic-v2-bound" };
    const accepted = verifyPocketBenchmarkEnvelope(slot, envelope, { plan: { [slot]: revised } } as never);
    assert.ok(accepted);
    assert.equal(accepted.maxOutputTokens, 4000);
  }
});
