/**
 * Group and dedupe customer-facing wait-for-confirmation reasons.
 */

export type ConfirmationReasonGroup = {
  id: string;
  label: string;
  technical: string[];
};

export type ConfirmationSummary = {
  headline: "WAIT FOR CONFIRMATION";
  primaryReasons: string[];
  technicalReasons: string[];
  groups: ConfirmationReasonGroup[];
};

const GROUP_RULES: Array<{ id: string; label: string; match: RegExp }> = [
  {
    id: "confirmation",
    label: "Supporting confirmation is incomplete",
    match: /confirm|incomplete|missing evidence|critical_input|missing_evidence|low_confidence/i,
  },
  {
    id: "levels",
    label: "Required reference levels are unavailable",
    match: /support|resistance|level|missing_level/i,
  },
  {
    id: "supporting-data",
    label: "Supporting market data is delayed or stale",
    match: /stale|delayed|aged|fallback|provider|offline|degraded|unavailable_data|data age|breadth|trend|momentum|volatility|macro/i,
  },
];

function normalizeReason(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function buildConfirmationSummary(reasons: readonly string[]): ConfirmationSummary {
  const unique = [...new Set(reasons.map(normalizeReason).filter(Boolean))];
  const groups: ConfirmationReasonGroup[] = GROUP_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    technical: unique.filter((reason) => rule.match.test(reason)),
  })).filter((group) => group.technical.length > 0);

  const assigned = new Set(groups.flatMap((group) => group.technical));
  const leftovers = unique.filter((reason) => !assigned.has(reason));
  if (leftovers.length) {
    groups.push({
      id: "other",
      label: "Additional confirmation checks remain open",
      technical: leftovers,
    });
  }

  const primaryReasons = (groups.length
    ? groups.map((group) => group.label)
    : ["Supporting confirmation is incomplete"]
  ).slice(0, 3);

  return {
    headline: "WAIT FOR CONFIRMATION",
    primaryReasons,
    technicalReasons: unique,
    groups,
  };
}
