/**
 * Rotating educational delight cards — curated copy only, never market fabrications.
 */

export type DelightCard = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
};

const TIPS: DelightCard[] = [
  {
    id: "patience",
    eyebrow: "Mindset",
    title: "Patience is a position",
    body: "Standing aside when confirmation is incomplete is an active risk decision — not inactivity.",
  },
  {
    id: "process",
    eyebrow: "Process",
    title: "Write the invalidation first",
    body: "If you cannot state what would prove you wrong, you are not ready to size a trade.",
  },
  {
    id: "delay",
    eyebrow: "Data hygiene",
    title: "Delayed is not live",
    body: "Treat every print as educational context. Execution still belongs on your broker’s live feed.",
  },
  {
    id: "size",
    eyebrow: "Risk",
    title: "Size for survival",
    body: "Volatility can expand suddenly. Prefer smaller participation until the tape confirms your plan.",
  },
  {
    id: "news",
    eyebrow: "Event risk",
    title: "Respect the calendar",
    body: "High-impact releases can invalidate tidy charts. Reduce size when the clock is against you.",
  },
  {
    id: "review",
    eyebrow: "Review",
    title: "Score the process, not the P&L",
    body: "A good day can be a no-trade day. Journal whether you followed your rules.",
  },
];

/** Pick a stable tip for the America/New_York trading day. */
export function delightCardForDay(now: Date | number = new Date()): DelightCard {
  const stamp = typeof now === "number" ? new Date(now) : now;
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(stamp);
  const index = Array.from(day).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TIPS.length;
  return TIPS[index]!;
}
