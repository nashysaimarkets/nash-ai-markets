import assert from "node:assert/strict";
import test from "node:test";
import { createEvidenceChain } from "../app/lib/evidence-chain.ts";

const provenance = { provider: "test", asOf: "2026-10-06T00:00:00Z", dataStatus: "LIVE", providerStatus: "connected", dataAgeMs: 1000, fallbackActive: false };

function fixtures() {
  const decision: any = {
    noTradeReasons: [],
    conflictingDrivers: [],
    topSupportingDrivers: [{ factor: "TREND" }],
  };
  const plan: any = {
    provenance,
    reasonsToRemainSidelined: [],
    dataQualityWarnings: [],
    executionReadiness: "ready",
    readyMyTrade: { status: "READY" },
  };
  return { decision, plan };
}

test("blocks when any data-quality warning exists", () => {
  const { decision, plan } = fixtures();
  plan.dataQualityWarnings = [{ code: "MISSING_LEVEL", field: "support" }];
  const chain = createEvidenceChain(decision, plan);
  assert.equal(chain.status, "BLOCKED");
  assert.ok(chain.reasons.includes("MISSING_LEVEL:support"));
});

test("blocks a stood-aside trade even without warnings", () => {
  const { decision, plan } = fixtures();
  plan.executionReadiness = "not-ready";
  plan.readyMyTrade.status = "STAND_ASIDE";
  assert.equal(createEvidenceChain(decision, plan).status, "BLOCKED");
});

test("reports conflict only after block conditions clear", () => {
  const { decision, plan } = fixtures();
  decision.conflictingDrivers = [{ factor: "INVERSE_VOLATILITY" }];
  const chain = createEvidenceChain(decision, plan);
  assert.equal(chain.status, "CONFLICT");
  assert.deepEqual(chain.reasons, ["CONFLICT:INVERSE_VOLATILITY"]);
});

test("verified requires clean evidence and preserves provenance", () => {
  const { decision, plan } = fixtures();
  const chain = createEvidenceChain(decision, plan);
  assert.equal(chain.status, "VERIFIED");
  assert.deepEqual(chain.reasons, ["VERIFIED:TREND"]);
  assert.equal(chain.provenance, provenance);
});

test("block takes precedence over conflict", () => {
  const { decision, plan } = fixtures();
  decision.conflictingDrivers = [{ factor: "TREND" }];
  decision.noTradeReasons = ["STALE_DATA"];
  const chain = createEvidenceChain(decision, plan);
  assert.equal(chain.status, "BLOCKED");
  assert.ok(chain.reasons.includes("STALE_DATA"));
});


test("blocks WAIT execution even when all other evidence is clean", () => {
  const { decision, plan } = fixtures();
  plan.executionReadiness = "wait";
  assert.equal(createEvidenceChain(decision, plan).status, "BLOCKED");
});

test("blocks PREVIEW provenance independently of warning arrays", () => {
  const { decision, plan } = fixtures();
  plan.provenance = { ...provenance, dataStatus: "PREVIEW" };
  const chain = createEvidenceChain(decision, plan);
  assert.equal(chain.status, "BLOCKED");
  assert.ok(chain.reasons.includes("DATA_STATUS_PREVIEW"));
});

test("blocks fallback provenance independently of warning arrays", () => {
  const { decision, plan } = fixtures();
  plan.provenance = { ...provenance, fallbackActive: true };
  const chain = createEvidenceChain(decision, plan);
  assert.equal(chain.status, "BLOCKED");
  assert.ok(chain.reasons.includes("FALLBACK_ACTIVE"));
});
