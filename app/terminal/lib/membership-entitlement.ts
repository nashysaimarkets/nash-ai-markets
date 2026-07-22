export type TerminalMembership = {
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
};

export type TerminalMembershipOutcome =
  | { kind: "entitled"; membership: TerminalMembership }
  | { kind: "expired" }
  | { kind: "missing" }
  | { kind: "temporarily_unavailable" };

const TERMINAL_PLANS = new Set(["pro", "elite"]);
const ENTITLED_STATUSES = new Set(["active", "trialing"]);

export type MembershipTier = "free" | "pro" | "elite";
export type PremiumTier = Exclude<MembershipTier, "free">;
export type TerminalFeature =
  | "market-overview"
  | "intelligence"
  | "decision-engine"
  | "trade-planner"
  | "launch-diagnostics"
  | "archive"
  | "yesterday-review"
  | "options-corner"
  | "journal"
  | "performance"
  | "results-centre"
  | "replay";

export type PreviewClaim = {
  target_tier: PremiumTier;
  period_start: string;
  claimed_at: string;
};

export type PreviewOffer = {
  targetTier: PremiumTier;
  cadence: "weekly" | "daily";
  periodStart: string;
  nextReset: string;
  eligible: boolean;
  active: boolean;
};

export type ProgressiveAccess = {
  tier: MembershipTier;
  effectiveTier: MembershipTier;
  features: Record<TerminalFeature, boolean>;
  previewOffer: PreviewOffer | null;
};

const TIER_RANK: Record<MembershipTier, number> = { free: 0, pro: 1, elite: 2 };
const FEATURE_TIER: Record<TerminalFeature, MembershipTier> = {
  "market-overview": "free",
  intelligence: "pro",
  "decision-engine": "pro",
  "trade-planner": "elite",
  "launch-diagnostics": "elite",
  archive: "pro",
  "yesterday-review": "pro",
  "options-corner": "pro",
  journal: "pro",
  performance: "pro",
  "results-centre": "elite",
  replay: "elite",
};

function startOfUtcDay(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function previewPeriod(tier: MembershipTier, now: number) {
  const dayStart = startOfUtcDay(now);
  if (tier === "free") {
    const day = new Date(dayStart).getUTCDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    const start = dayStart - mondayOffset * 86_400_000;
    return { targetTier: "pro" as const, cadence: "weekly" as const, start, end: start + 7 * 86_400_000 };
  }
  if (tier === "pro") return { targetTier: "elite" as const, cadence: "daily" as const, start: dayStart, end: dayStart + 86_400_000 };
  return null;
}

export function resolveMembershipTier(membership: TerminalMembership | null, queryFailed: boolean, now = Date.now()): MembershipTier | "temporarily_unavailable" {
  if (queryFailed) return "temporarily_unavailable";
  const plan = membership?.plan?.toLowerCase();
  if (plan !== "pro" && plan !== "elite") return "free";
  const periodEnd = Date.parse(membership?.current_period_end ?? "");
  if (!ENTITLED_STATUSES.has(membership?.status ?? "") || !Number.isFinite(periodEnd) || periodEnd <= now) return "free";
  return plan;
}

export function createProgressiveAccess(tier: MembershipTier, claims: readonly PreviewClaim[], now = Date.now()): ProgressiveAccess {
  const period = previewPeriod(tier, now);
  const matchingClaim = period
    ? claims.find((claim) => claim.target_tier === period.targetTier && Date.parse(claim.period_start) === period.start)
    : undefined;
  const active = Boolean(matchingClaim && Date.parse(matchingClaim.claimed_at) >= period!.start && Date.parse(matchingClaim.claimed_at) < period!.end);
  const effectiveTier = active && period ? period.targetTier : tier;
  const features = Object.fromEntries(
    Object.entries(FEATURE_TIER).map(([feature, required]) => [feature, TIER_RANK[effectiveTier] >= TIER_RANK[required]]),
  ) as Record<TerminalFeature, boolean>;
  return {
    tier,
    effectiveTier,
    features,
    previewOffer: period ? {
      targetTier: period.targetTier,
      cadence: period.cadence,
      periodStart: new Date(period.start).toISOString(),
      nextReset: new Date(period.end).toISOString(),
      eligible: !matchingClaim,
      active,
    } : null,
  };
}

export function canClaimPreview(tier: MembershipTier, targetTier: PremiumTier, claims: readonly PreviewClaim[], now = Date.now()): boolean {
  const access = createProgressiveAccess(tier, claims, now);
  return access.previewOffer?.targetTier === targetTier && access.previewOffer.eligible;
}

export function evaluateTerminalMembership(
  membership: TerminalMembership | null,
  queryFailed: boolean,
  now = Date.now(),
): TerminalMembershipOutcome {
  if (queryFailed) return { kind: "temporarily_unavailable" };
  if (!membership || !TERMINAL_PLANS.has(membership.plan ?? "")) return { kind: "missing" };

  const periodEnd = Date.parse(membership.current_period_end ?? "");
  if (!Number.isFinite(periodEnd) || periodEnd <= now) return { kind: "expired" };
  if (!ENTITLED_STATUSES.has(membership.status ?? "")) return { kind: "missing" };

  return { kind: "entitled", membership };
}

export function membershipRedirect(outcome: Exclude<TerminalMembershipOutcome["kind"], "entitled">): string {
  if (outcome === "expired") return "/membership-required?reason=expired";
  if (outcome === "temporarily_unavailable") return "/membership-required?reason=temporary";
  return "/membership-required?reason=missing";
}
