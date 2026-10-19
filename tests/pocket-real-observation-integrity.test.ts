import assert from "node:assert/strict";
import test from "node:test";
import { caseId, realObservation } from "../scripts/pocket-real-benchmark-fixture.ts";

const id = caseId("range-clear-01");
const chart = () => ({
  levels: [{ kind: "support", price: "6405.20", y: 50 }],
  patterns: [{ name: "DOUBLE TOP", status: "CONFIRMED", geometry: { points: [{ x: 20, y: 30 }, { x: 50, y: 70 }, { x: 80, y: 30 }] } }],
  liquidity: { state: "VERIFIED", event: "SWEEP", zones: [{ side: "BUY_SIDE", basis: "EQUAL_HIGHS", priceLow: 6400, priceHigh: 6410, x: 10, x2: 80 }] },
});

test("numeric string overflow never becomes non-finite scored level or liquidity evidence", () => {
  for (const bad of ["9".repeat(400), "-" + "9".repeat(400)]) {
    assert.throws(() => realObservation(id, { ...chart(), levels: [{ kind: "support", price: bad, y: 50 }] }, 12), /Invalid level evidence/);
    for (const field of ["priceLow", "priceHigh"] as const) {
      const zone = { ...chart().liquidity.zones[0], [field]: bad };
      assert.throws(() => realObservation(id, { ...chart(), liquidity: { ...chart().liquidity, zones: [zone] } }, 12), /Invalid liquidity evidence/);
    }
  }
});

test("a nonzero decimal that underflows cannot be silently measured as zero", () => {
  for (const bad of ["0." + "0".repeat(400) + "1", "-0." + "0".repeat(400) + "1"]) {
    assert.throws(() => realObservation(id, { ...chart(), levels: [{ kind: "support", price: bad, y: 50 }] }, 12), /Invalid level evidence/);
  }
});

test("latency must be a finite nonnegative number, with no coercion or fabricated fallback", () => {
  for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "12", null, undefined]) {
    assert.throws(() => realObservation(id, chart(), bad as number), /Invalid scanner latency/);
  }
  for (const measured of [0, 12.25, 900]) assert.equal(realObservation(id, chart(), measured).latency_ms, measured);
});

test("unknown or prototype source IDs cannot acquire a pinned image identity", () => {
  for (const bad of ["__proto__", "toString", "not-a-case", "", undefined]) {
    assert.throws(() => realObservation(bad as typeof id, chart(), 12), /ONE pinned real-image case/);
  }
});

test("nonempty liquidity projection requires a string event so JSON cannot omit or reshape it", () => {
  for (const bad of [undefined, null, [], {}, 1, true]) {
    assert.throws(() => realObservation(id, { ...chart(), liquidity: { ...chart().liquidity, event: bad } }, 12), /Invalid liquidity event evidence/);
  }
  const unknown = realObservation(id, { ...chart(), liquidity: { ...chart().liquidity, event: "WRONG_EVENT_HYPOTHESIS" } }, 12);
  assert.equal(unknown.liquidity_zones[0].event, "WRONG_EVENT_HYPOTHESIS");
});

test("all projected geometric coordinates remain finite and inside original-image bounds", () => {
  for (const bad of [-0.001, 100.001, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "50", null]) {
    assert.throws(() => realObservation(id, { ...chart(), levels: [{ kind: "support", price: "6405", y: bad }] }, 12), /Invalid level evidence/);
    assert.throws(() => realObservation(id, { ...chart(), patterns: [{ name: "DOUBLE TOP", status: "CONFIRMED", geometry: { points: [{ x: bad, y: 30 }] } }] }, 12), /Invalid pattern pivots/);
    assert.throws(() => realObservation(id, { ...chart(), liquidity: { ...chart().liquidity, zones: [{ ...chart().liquidity.zones[0], x2: bad }] } }, 12), /Invalid liquidity evidence/);
  }
  const observation = realObservation(id, {
    levels: [{ kind: "support", price: "6405.20", y: 100 }],
    patterns: [{ name: "DOUBLE TOP", status: "CONFIRMED", geometry: { points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] } }],
    liquidity: { event: "NONE", zones: [{ side: "BUY_SIDE", basis: "EQUAL_HIGHS", priceLow: 6400, priceHigh: 6410, x: 0, x2: 100 }] },
  }, 12);
  assert.equal(observation.levels[0].y_px, 850);
  assert.deepEqual(observation.patterns[0].geometry, [{ x_px: 0, y_px: 0 }, { x_px: 1400, y_px: 850 }]);
  assert.deepEqual([observation.liquidity_zones[0].x_px, observation.liquidity_zones[0].x2_px], [0, 1400]);
});

test("finite wrong claims remain available for independent false-positive/error scoring", () => {
  const wrong = {
    levels: [{ kind: "WRONG_KIND", price: "-123.5", y: 25 }],
    patterns: [{ name: "WRONG_PATTERN", status: "CONFIRMED", geometry: { points: [{ x: 80, y: 20 }, { x: 30, y: 70 }, { x: 30, y: 70 }] } }],
    liquidity: { state: "NONE", event: "WRONG_EVENT", zones: [{ side: "BUY_SIDE", basis: "EQUAL_LOWS", priceLow: -20, priceHigh: -10, x: 10, x2: 80 }] },
  };
  const before = JSON.stringify(wrong);
  const observation = realObservation(id, wrong, 12);
  assert.deepEqual(observation.levels[0], { kind: "WRONG_KIND", price: -123.5, y_px: 212.5 });
  assert.equal(observation.patterns[0].name, "WRONG_PATTERN");
  assert.equal(observation.patterns[0].geometry.length, 3);
  assert.deepEqual(observation.patterns[0].geometry[1], observation.patterns[0].geometry[2]);
  assert.equal(observation.liquidity_zones[0].basis, "EQUAL_LOWS");
  assert.equal(observation.liquidity_zones[0].event, "WRONG_EVENT");
  assert.deepEqual(observation.liquidity_zones[0].price_interval, [-20, -10]);
  assert.equal(JSON.stringify(wrong), before, "the adapter does not repair or prune wrong hypotheses");
});

test("sparse pattern hypotheses remain representable instead of being silently discarded", () => {
  for (const points of [[], [{ x: 20, y: 30 }]]) {
    const result = realObservation(id, { ...chart(), patterns: [{ name: "DOUBLE TOP", status: "CONFIRMED", geometry: { points } }] }, 12);
    assert.equal(result.patterns.length, 1);
    assert.equal(result.patterns[0].geometry.length, points.length);
  }
});

test("representable finite extreme prices and explicit zero survive JSON roundtrip", () => {
  for (const value of [Number.MAX_VALUE, Number.MIN_VALUE, -Number.MAX_VALUE, -Number.MIN_VALUE, "0", "-0.000", "123.456"]) {
    const result = realObservation(id, { ...chart(), levels: [{ kind: "support", price: value, y: 50 }] }, 12);
    const json = JSON.parse(JSON.stringify(result)) as { levels: { price: number }[] };
    assert.equal(Number.isFinite(json.levels[0].price), true);
    assert.equal(result.levels[0].price, Number(value));
    assert.equal(json.levels[0].price, Number(value) === 0 ? 0 : Number(value));
  }
});

test("missing scanner collections remain unmeasurable, separate from an explicit empty result", () => {
  for (const data of [null, [], {}, { levels: [], patterns: [] }, { levels: [], patterns: [], liquidity: {} }]) {
    assert.throws(() => realObservation(id, data, 12), /Unmeasurable scanner response|Missing scanners/);
  }
  const empty = realObservation(id, { levels: [], patterns: [], liquidity: { state: "NONE", event: "NONE", zones: [] } }, 12);
  assert.deepEqual([empty.levels, empty.patterns, empty.liquidity_zones], [[], [], []]);
  assert.equal(empty.status, "completed");
  assert.equal(empty.scored, true, "adapter compatibility is preserved; release/provisional scoring remains external");
});
