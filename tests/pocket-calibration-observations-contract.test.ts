/** Synthetic contract checks; no provider calls or semantic absence credit. */
import test from "node:test";
import assert from "node:assert/strict";
import { calibratePocketAnalysis } from "../app/api/pocket/analysis-calibration.ts";
import { normalizeInternalDiagnosticObservation } from "../scripts/pocket-monaco-internal-diagnostics.ts";

const witnesses = [
  { kind: "equal-highs", side: "buy-side", x: 25, y: 30, confidence: "HIGH" },
  { kind: "equal-highs", side: "buy-side", x: 60, y: 30, confidence: "HIGH" },
];
function fixture(observations: unknown, path = "none") {
  const liquidity: Record<string, unknown> = {
    state: path === "none" ? "NONE" : "VERIFIED", event: "NONE", confidence: "HIGH",
    evidence: path === "no-evidence" ? "" : "Synthetic visible reactions",
    confirmation: "Synthetic condition", invalidation: "Synthetic condition",
    zones: path === "none" || path === "no-zones" ? [] : [
      { side: "BUY_SIDE", basis: "EQUAL_HIGHS", price: "7750", x: 18, x2: 82, y: 30 },
    ],
  };
  if (observations !== undefined) liquidity.observations = observations;
  return {
    evidenceQuality: { chartReadability: path === "unreadable" ? "POOR" : "CLEAR", candlesReadable: path !== "unreadable", scaleReadable: true, instrumentConfidence: "HIGH", timeframeConfidence: "HIGH" },
    setupScore: { overall: 60 }, plotBounds: { left: 5, top: 10, right: 90, bottom: 90 },
    priceScaleAnchors: [{ price: 7800, y: 20 }, { price: 7650, y: 50 }, { price: 7500, y: 80 }],
    patterns: [], levels: [{ kind: "support", price: "7650", x: 5, x2: 90, y: 50, y2: 50 }],
    liquidity,
  };
}
type Calibrated = { liquidity: Record<string, unknown>; levels: unknown[]; priceScaleAnchors: unknown[] };
const normalize = (value: unknown) => normalizeInternalDiagnosticObservation(Buffer.from(JSON.stringify(value)), { width: 1400, height: 850 });
const paths = ["none", "unreadable", "no-zones", "no-evidence"];

test("explicit NONE and empty observations survive calibration so independent geometry remains measurable", () => {
  const source = fixture([]), before = structuredClone(source);
  const output = calibratePocketAnalysis(source) as Calibrated;
  assert.deepEqual(output.liquidity.observations, []);
  const diagnostic = normalize(output);
  assert.equal(diagnostic.status, "NORMALIZED");
  if (diagnostic.status !== "NORMALIZED") return;
  assert.equal(diagnostic.axisAnchors.length, 3);
  assert.equal(diagnostic.levels.length, 1);
  assert.equal(diagnostic.witnesses.length, 0);
  assert.equal(diagnostic.zones.length, 0);
  assert.equal("noSignal" in diagnostic.raw, false, "Zero emitted observations is not a no-signal assertion");
  assert.deepEqual(source, before, "Calibration must not mutate raw provider input");
});

test("each early NONE exit retains explicitly supplied empty observations", () => {
  for (const path of paths) {
    const output = calibratePocketAnalysis(fixture([], path)) as Calibrated;
    assert.equal(output.liquidity.state, "NONE", path);
    assert.deepEqual(output.liquidity.observations, [], path);
    assert.equal(normalize(output).status, "NORMALIZED", path);
  }
});

test("missing observations are never fabricated as an empty array on early or blocked-chain paths", () => {
  for (const path of [...paths, "blocked-chain"]) {
    const output = calibratePocketAnalysis(fixture(undefined, path)) as Calibrated;
    assert.equal(output.liquidity.observations, undefined, path);
    assert.equal("observations" in JSON.parse(JSON.stringify(output)).liquidity, false, path);
    assert.deepEqual(normalize(output), {
      status: "UNMEASURED", reason: "MALFORMED_OBSERVATIONS",
      rawResponseSha256: normalize(output).rawResponseSha256,
    }, path);
  }
});

test("malformed observations retain their malformed meaning through every calibration path", () => {
  for (const observations of [null, {}, [null], [{ ...witnesses[0], kind: "hidden-orders" }], Array(13).fill(witnesses[0])]) {
    for (const path of [...paths, "blocked-chain"]) {
      const source = fixture(observations, path), before = structuredClone(source);
      const output = calibratePocketAnalysis(source) as Calibrated;
      assert.deepEqual(output.liquidity.observations, observations, path);
      assert.equal(normalize(output).status, "UNMEASURED", path);
      assert.deepEqual(source, before, path);
    }
  }
});

test("discarded zones cannot erase nonempty witnesses and masquerade as a known-empty NONE result", () => {
  for (const path of paths) {
    const output = calibratePocketAnalysis(fixture(witnesses, path)) as Calibrated;
    assert.deepEqual(output.liquidity.observations, witnesses, path);
    const diagnostic = normalize(output);
    assert.equal(diagnostic.status, "UNMEASURED", path);
    if (diagnostic.status === "UNMEASURED") assert.equal(diagnostic.reason, "CONTRADICTORY_LIQUIDITY_NONE", path);
  }
});

test("a blocked evidence chain preserves the reported witness without granting verification", () => {
  const output = calibratePocketAnalysis(fixture([witnesses[0]], "blocked-chain")) as Calibrated;
  assert.equal(output.liquidity.state, "PARTIAL");
  assert.deepEqual(output.liquidity.observations, [witnesses[0]]);
  assert.equal((output.liquidity.evidenceChain as { status: string }).status, "BLOCKED");
  const diagnostic = normalize(output);
  assert.equal(diagnostic.status, "NORMALIZED");
  if (diagnostic.status === "NORMALIZED") assert.equal(diagnostic.witnesses.length, 1);
});

test("absent liquidity cannot acquire fabricated observations", () => {
  const output = calibratePocketAnalysis({ ...fixture([]), liquidity: undefined }) as Calibrated;
  assert.equal(output.liquidity.observations, undefined);
  const diagnostic = normalize(output);
  assert.equal(diagnostic.status, "UNMEASURED");
  if (diagnostic.status === "UNMEASURED") assert.equal(diagnostic.reason, "MALFORMED_OBSERVATIONS");
});
