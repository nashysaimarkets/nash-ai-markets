export type MorningBriefInput = {
  source: "verified" | "placeholder" | "unavailable";
  asOf: string;
  sessionLabel: string;
  marketCondition?: string;
  confidence?: number | null;
  directionalBias?: string | null;
  keyRisk?: string;
  nextAction?: string;
};

export type MorningBrief = {
  schemaVersion: "1.0";
  mode: "verified" | "preview" | "unavailable";
  label: string;
  asOf: string | null;
  sessionLabel: string;
  headline: string;
  confidence: number | null;
  directionalBias: string | null;
  priorities: string[];
  checklist: string[];
  actionable: boolean;
  warning: string | null;
};

export const MORNING_BRIEF_PLACEHOLDER_INPUT: MorningBriefInput = {
  source: "placeholder",
  asOf: "2024-01-02T08:00:00.000Z",
  sessionLabel: "Preview workspace",
  marketCondition: "Verified market condition will appear here",
  confidence: null,
  directionalBias: null,
  keyRisk: "Current provider data is required before market guidance is displayed.",
  nextAction: "Connect a verified provider or wait for the next successful refresh.",
};

function boundedConfidence(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : null;
}

export function createMorningBrief(input: MorningBriefInput): MorningBrief {
  if (input.source === "placeholder") {
    return {
      schemaVersion: "1.0",
      mode: "preview",
      label: "PREVIEW STRUCTURE · NOT CURRENT MARKET DATA",
      asOf: input.asOf,
      sessionLabel: input.sessionLabel,
      headline: "Your verified morning brief will appear here",
      confidence: null,
      directionalBias: null,
      priorities: [
        "Confirm provider freshness",
        "Review scheduled event risk",
        "Wait for deterministic engine synchronization",
      ],
      checklist: [
        "No market direction is active",
        "No price levels have been generated",
        "Refresh after verified data becomes available",
      ],
      actionable: false,
      warning: input.keyRisk ?? "Placeholder content cannot be used for trading decisions.",
    };
  }

  const asOf = Date.parse(input.asOf);
  const confidence = boundedConfidence(input.confidence);
  const complete = input.source === "verified"
    && Number.isFinite(asOf)
    && confidence !== null
    && Boolean(input.marketCondition && input.directionalBias && input.keyRisk && input.nextAction);
  if (!complete) {
    return {
      schemaVersion: "1.0",
      mode: "unavailable",
      label: "MORNING BRIEF UNAVAILABLE",
      asOf: null,
      sessionLabel: input.sessionLabel,
      headline: "Verified inputs are incomplete",
      confidence: null,
      directionalBias: null,
      priorities: [],
      checklist: ["Wait for a complete verified provider update", "Refresh the executive dashboard"],
      actionable: false,
      warning: "No directional guidance is available from incomplete or unverified inputs.",
    };
  }

  return {
    schemaVersion: "1.0",
    mode: "verified",
    label: "VERIFIED MORNING BRIEF",
    asOf: new Date(asOf).toISOString(),
    sessionLabel: input.sessionLabel,
    headline: input.marketCondition!,
    confidence,
    directionalBias: input.directionalBias!,
    priorities: [input.keyRisk!, input.nextAction!],
    checklist: [
      "Confirm provider status before acting",
      "Review event and volatility warnings",
      "Recalculate after material conditions change",
    ],
    actionable: true,
    warning: null,
  };
}
