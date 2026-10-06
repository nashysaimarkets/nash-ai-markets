import type { TradePlan } from "./structured-trade-planner.ts";
import type { TradingDecision } from "./trading-decision-engine.ts";

export type EvidenceChainStatus = "VERIFIED" | "CONFLICT" | "BLOCKED";

export type EvidenceChain = {
  schemaVersion: "1.0";
  status: EvidenceChainStatus;
  reasons: string[];
  provenance: TradePlan["provenance"];
};

const MAX_DELAYED_AGE_MS = 30 * 60 * 1000;
const unique = (values: string[]) => [...new Set(values)];

export function createEvidenceChain(decision: TradingDecision, plan: TradePlan): EvidenceChain {
  const provenanceBlocks: string[] = [];
  if (plan.provenance.dataStatus === "PREVIEW" || plan.provenance.dataStatus === "UNAVAILABLE") {
    provenanceBlocks.push(`DATA_STATUS_${plan.provenance.dataStatus}`);
  }
  if (plan.provenance.providerStatus === "offline" || plan.provenance.providerStatus === "not_configured") {
    provenanceBlocks.push("PROVIDER_UNAVAILABLE");
  }
  if (plan.provenance.fallbackActive) provenanceBlocks.push("FALLBACK_ACTIVE");
  if (plan.provenance.dataAgeMs === null) provenanceBlocks.push("UNKNOWN_DATA_AGE");
  else if (plan.provenance.dataAgeMs > MAX_DELAYED_AGE_MS) provenanceBlocks.push("STALE_DATA");

  const blocked = unique([
    ...decision.noTradeReasons,
    ...plan.reasonsToRemainSidelined,
    ...plan.dataQualityWarnings.map((warning) => `${warning.code}:${warning.field}`),
    ...provenanceBlocks,
    ...(plan.executionReadiness !== "ready" ? [`EXECUTION_${plan.executionReadiness.toUpperCase().replace("-", "_")}`] : []),
    ...(plan.readyMyTrade.status !== "READY" ? [`READY_MY_TRADE_${plan.readyMyTrade.status}`] : []),
  ]);

  if (blocked.length > 0) {
    return { schemaVersion: "1.0", status: "BLOCKED", reasons: blocked, provenance: plan.provenance };
  }

  const conflicts = unique(decision.conflictingDrivers.map((driver) => `CONFLICT:${driver.factor}`));
  if (conflicts.length > 0) {
    return { schemaVersion: "1.0", status: "CONFLICT", reasons: conflicts, provenance: plan.provenance };
  }

  return {
    schemaVersion: "1.0",
    status: "VERIFIED",
    reasons: unique(decision.topSupportingDrivers.map((driver) => `VERIFIED:${driver.factor}`)),
    provenance: plan.provenance,
  };
}
