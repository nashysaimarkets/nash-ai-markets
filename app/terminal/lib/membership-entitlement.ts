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
