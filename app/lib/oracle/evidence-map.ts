import type {
  ConvictionExplainerModel,
  ConvictionFactor,
  ConvictionRelation,
} from "./conviction-explainer.ts";

export type EvidenceMapLane = "supportive" | "restrictive" | "neutral" | "unavailable";

export type EvidenceMapNode = ConvictionFactor & {
  displayLabel: string;
  displayDataStatus: ConvictionFactor["dataStatus"] | "Example only";
  displayExplanation: string;
  lane: EvidenceMapLane;
  relationLabel: "Supportive" | "Restrictive" | "Neutral" | "Unavailable";
  sourceLabel: string;
};

export type EvidenceMapModel = {
  available: boolean;
  verified: boolean;
  exampleOnly: boolean;
  nodes: EvidenceMapNode[];
  counts: Record<EvidenceMapLane, number>;
  summary: string;
  outcome: {
    permissionLabel: string;
    permissionTone: "open" | "caution" | "blocked";
    leanLabel: string;
    primaryRisk: string;
    freshness: string;
    headline: string;
  };
  methodology: string;
};

const FACTOR_PRESENTATION: Record<string, { label: string; source: string }> = {
  trend: { label: "ES structure", source: "Structure factor status" },
  momentum: { label: "ES momentum", source: "Momentum factor status" },
  volatility: { label: "VIX", source: "Volatility print status" },
  yields: { label: "Treasury yields", source: "US 10-year print status" },
  dollar: { label: "US dollar", source: "Dollar print status" },
  breadth: { label: "Market breadth", source: "Breadth feed status" },
  "event-risk": { label: "Catalyst risk", source: "Economic calendar status" },
  "data-completeness": { label: "Data integrity", source: "Bullseye safety gate" },
};

function laneFromRelation(relation: ConvictionRelation): EvidenceMapLane {
  if (relation === "supports") return "supportive";
  if (relation === "opposes" || relation === "caution") return "restrictive";
  if (relation === "unavailable") return "unavailable";
  return "neutral";
}

function relationLabel(lane: EvidenceMapLane): EvidenceMapNode["relationLabel"] {
  if (lane === "supportive") return "Supportive";
  if (lane === "restrictive") return "Restrictive";
  if (lane === "unavailable") return "Unavailable";
  return "Neutral";
}

function outcomeHeadline(input: {
  verified: boolean;
  permissionTone: "open" | "caution" | "blocked";
}): string {
  if (!input.verified) return "Decision permission remains closed";
  if (input.permissionTone === "open") return "Participation checks are currently open";
  if (input.permissionTone === "caution") return "Participation remains conditional";
  return "Evidence does not clear participation";
}

export function buildEvidenceMap(input: {
  conviction: ConvictionExplainerModel;
  verified: boolean;
  exampleOnly?: boolean;
  permissionLabel: string;
  permissionTone: "open" | "caution" | "blocked";
  leanLabel: string;
  primaryRisk: string | null;
  freshness: string;
}): EvidenceMapModel {
  const nodes = input.conviction.factors.map((factor) => {
    const presentation = FACTOR_PRESENTATION[factor.id] ?? {
      label: factor.label,
      source: "Existing verified factor",
    };
    const lane = laneFromRelation(factor.relation);
    return {
      ...factor,
      displayLabel: presentation.label,
      displayDataStatus: input.exampleOnly ? "Example only" : factor.dataStatus,
      displayExplanation: input.exampleOnly
        ? `${presentation.label} is ${relationLabel(lane).toLowerCase()} in this deterministic example. No live or verified reading is implied.`
        : factor.explanation,
      lane,
      relationLabel: relationLabel(lane),
      sourceLabel: input.exampleOnly ? "Illustrative factor — not a live source" : presentation.source,
    };
  });

  const counts: EvidenceMapModel["counts"] = {
    supportive: 0,
    restrictive: 0,
    neutral: 0,
    unavailable: 0,
  };
  for (const node of nodes) counts[node.lane] += 1;

  const permissionTone = input.verified ? input.permissionTone : "blocked";
  const permissionLabel = input.verified ? input.permissionLabel : "WAIT FOR VERIFIED CONTEXT";
  const primaryRisk = input.verified
    ? input.primaryRisk ?? "No principal restriction is listed"
    : "Verified decision context is incomplete";

  return {
    available: input.conviction.available,
    verified: input.verified,
    exampleOnly: input.exampleOnly === true,
    nodes,
    counts,
    summary: `${counts.supportive} supportive · ${counts.restrictive} restrictive · ${counts.neutral} neutral · ${counts.unavailable} unavailable`,
    outcome: {
      permissionLabel,
      permissionTone,
      leanLabel: input.leanLabel,
      primaryRisk,
      freshness: input.freshness,
      headline: outcomeHeadline({ verified: input.verified, permissionTone }),
    },
    methodology: input.exampleOnly
      ? "Deterministic example-only factor map for private presentation. No node is live or verified. The map never recalculates or opens decision permission."
      : `${input.conviction.methodology} This map only visualises existing factor states; it never recalculates the decision.`,
  };
}
