import test from "node:test";
import assert from "node:assert/strict";
import { createReportTransport } from "../app/api/pocket/report-transport";
import { scanProfile } from "../app/api/pocket/scan-profile";

const schema = { type: "object", additionalProperties: false, properties: {
  instrumentIdentifier: { type: "string", maxLength: 80 },
  currentPrice: { type: "string", maxLength: 30 },
  uncertainty: { type: "string", maxLength: 140 },
  patterns: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, properties: {
    sourceRole: { type: "string", enum: ["PRIMARY", "HIGHER_TIMEFRAME"] },
    confirmation: { type: "string", maxLength: 180 },
    geometry: { type: "object", additionalProperties: false, properties: { x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 } }, required: ["x", "y"] },
  }, required: ["sourceRole", "confirmation", "geometry"] } },
}, required: ["instrumentIdentifier", "currentPrice", "uncertainty", "patterns"] };

test("short transport keys preserve all evidence and exact decimals over varied records", () => {
  const codec = createReportTransport(schema);
  for (let n = 0; n < 100; n++) {
    const report = { instrumentIdentifier: "US 500 (DFB)", currentPrice: "6173.4500", uncertainty: "Scale unclear: withhold any unsupported price", patterns: [{ sourceRole: n % 2 ? "PRIMARY" : "HIGHER_TIMEFRAME", confirmation: "Wait for a close AND a retest; neither is yet visible", geometry: { x: n / 2, y: 99 - n / 2 } }] };
    const encoded = codec.encode(report);
    assert.deepEqual(codec.decode(JSON.parse(JSON.stringify(encoded))), report);
    assert.ok(JSON.stringify(encoded).length < JSON.stringify(report).length);
  }
  assert.equal(codec.schema.properties?.f0.description, "instrumentIdentifier");
});

test("missing, substituted, unexpected and out-of-range fields fail closed", () => {
  const codec = createReportTransport(schema);
  for (const bad of [null, {}, { f0: "Gold", f1: "100", f2: "", f3: [], extra: 1 }, { f0: "Gold", f1: 100, f2: "", f3: [] }, { f0: "Gold", f1: "100", f2: "", f3: [{ f0: "OTHER", f1: "", f2: { f0: 10, f1: 50 } }] }, { f0: "Gold", f1: "100", f2: "", f3: [{ f0: "PRIMARY", f1: "", f2: { f0: 101, f1: 50 } }] }]) assert.throws(() => codec.decode(bad));
});

test("lower-reasoning trial cannot be selected on customer or unrelated preview deployments", () => {
  const request = new Request("https://example.test", { headers: { "x-pocket-trial-profile": "lossless-low" } });
  assert.equal(scanProfile(request, {}), "full-parallel");
  assert.equal(scanProfile(request, { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "feat/pocket-evidence-speed-2026-09-11" }), "full-parallel");
  assert.equal(scanProfile(request, { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "other" }), "full-parallel");
  assert.equal(scanProfile(request, { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feat/pocket-evidence-speed-2026-09-11" }), "lossless-low");
});

test('bounded number transport preserves exact finite values and every semantic field', () => {
  const numericSchema = { type: 'object', additionalProperties: false, properties: { value: { type: 'number' }, count: { type: 'integer', minimum: 0, maximum: 100 } }, required: ['value','count'] };
  const codec = createReportTransport(numericSchema, { boundedNumbers: true, aliasKeys: false });
  for (const value of [0, -100, 7723.23, 0.12345678901234566, Number.MAX_VALUE, Number.MIN_VALUE, 1e-300]) {
    const input = { value, count: 4 }; assert.deepEqual(codec.decode(codec.encode(input)), input);
  }
  assert.deepEqual(codec.schema.required, numericSchema.required);
  assert.equal(codec.schema.properties?.value.type, 'string');
  assert.match(codec.schema.properties?.value.description ?? '', /Exact numeric value/);
  assert.equal(codec.schema.properties?.value.maxLength, 40);
  assert.deepEqual(codec.schema.properties?.count.enum, Array.from({ length: 101 }, (_, index) => String(index)));
  assert.match(codec.schema.properties?.count.description ?? '', /Whole integer only.*Minimum 0.*Maximum 100/);
  for (const value of ['1'.repeat(1000), 'NaN', 'Infinity', '1e999', '1e-999', ' 1', '01', '1,000', 1, null]) assert.throws(() => codec.decode({ value, count: '4' }));
  for (const count of ['101', '-1', '1.5']) assert.throws(() => codec.decode({ value: '7723.23', count }));
});
