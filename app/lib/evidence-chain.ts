import type { TradePlan } from "./structured-trade-planner.ts";
import type { TradingDecision } from "./trading-decision-engine.ts";

export type EvidenceChainStatus = "VERIFIED" | "CONFLICT" | "BLOCKED";

export type EvidenceChain = {
  schemaVersion: "1.0";
  status: EvidenceChainStatus;
  reasons: string[];
  provenance: TradePlan["provenance"];
};

const unique = (values: string[]) => [...new Set(values)];

export function createEvidenceChain(decision: TradingDecision, plan: TradePlan): EvidenceChain {
  const blocked = unique([
    ...decision.noTradeReasons,
    ...plan.reasonsToRemainSidelined,
    ...plan.dataQualityWarnings.map((warning) => `${warning.code}:${warning.field}`),
    ...(plan.executionReadiness === "not-ready" ? ["EXECUTION_NOT_READY"] : []),
    ...(plan.readyMyTrade.status === "STAND_ASIDE" ? ["READY_MY_TRADE_STAND_ASIDE"] : []),
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
