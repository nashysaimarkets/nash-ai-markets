export type ProcessJournalRow = {
  traded_at: string;
  direction: string;
  followed_plan: boolean | null;
  respected_confirmation: boolean | null;
  respected_invalidation: boolean | null;
};

function startOfUtcWeek(now: Date): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
  return start;
}

function countRecorded(rows: ProcessJournalRow[], field: "followed_plan" | "respected_confirmation" | "respected_invalidation") {
  const recorded = rows.filter((row) => typeof row[field] === "boolean");
  return {
    recorded: recorded.length,
    respected: recorded.filter((row) => row[field] === true).length,
    missed: recorded.filter((row) => row[field] === false).length,
  };
}

export function weeklyProcessReview(rows: ProcessJournalRow[], now = new Date()) {
  const weekStart = startOfUtcWeek(now);
  const nextWeek = new Date(weekStart);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  const entries = rows.filter((row) => {
    const timestamp = Date.parse(row.traded_at);
    return Number.isFinite(timestamp) && timestamp >= weekStart.getTime() && timestamp < nextWeek.getTime();
  });

  const plan = countRecorded(entries, "followed_plan");
  const confirmation = countRecorded(entries, "respected_confirmation");
  const invalidation = countRecorded(entries, "respected_invalidation");
  const standAside = entries.filter((row) => row.direction === "neutral").length;

  let focus = "Capture one decision this week so the review has a truthful starting point.";
  if (entries.length) {
    if (plan.missed) focus = "Focus on following the plan you recorded before the session.";
    else if (confirmation.missed) focus = "Focus on waiting for the recorded confirmation before acting.";
    else if (invalidation.missed) focus = "Focus on respecting the invalidation condition without renegotiating it.";
    else if (plan.recorded < entries.length || confirmation.recorded < entries.length) {
      focus = "Complete the process fields after each decision so the weekly record is usable.";
    } else {
      focus = "Keep the routine consistent; the recorded process conditions were respected this week.";
    }
  }

  return {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: new Date(nextWeek.getTime() - 1).toISOString().slice(0, 10),
    decisions: entries.length,
    standAside,
    directional: entries.length - standAside,
    plan,
    confirmation,
    invalidation,
    focus,
  };
}
