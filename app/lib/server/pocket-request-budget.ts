import { createHash } from "node:crypto";

export type PocketBudgetAction = "preflight" | "analyse" | "review" | "follow-up";

type BudgetRule = { limit: number; windowMs: number };
type BudgetEntry = { count: number; resetAt: number };

const RULES: Record<PocketBudgetAction, BudgetRule> = {
  preflight: { limit: 8, windowMs: 30 * 60_000 },
  analyse: { limit: 4, windowMs: 30 * 60_000 },
  review: { limit: 3, windowMs: 30 * 60_000 },
  "follow-up": { limit: 10, windowMs: 30 * 60_000 },
};

const entries = new Map<string, BudgetEntry>();

function requesterKey(request: Request, action: PocketBudgetAction) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  const salt = process.env.POCKET_BUDGET_SALT?.trim() || "pocket-beta-budget-v1";
  return createHash("sha256").update(`${salt}:${action}:${address}`).digest("hex");
}

export type PocketBudgetDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export function takePocketBudget(
  request: Request,
  action: PocketBudgetAction,
  now = Date.now(),
): PocketBudgetDecision {
  const rule = RULES[action];
  const key = requesterKey(request, action);
  const current = entries.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + rule.windowMs }
    : current;

  if (entry.count >= rule.limit) {
    return {
      allowed: false,
      limit: rule.limit,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  entry.count += 1;
  entries.set(key, entry);
  return {
    allowed: true,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - entry.count),
    resetAt: entry.resetAt,
    retryAfterSeconds: 0,
  };
}

export function pocketBudgetHeaders(decision: PocketBudgetDecision) {
  return {
    "cache-control": "no-store",
    "x-ratelimit-limit": String(decision.limit),
    "x-ratelimit-remaining": String(decision.remaining),
    "x-ratelimit-reset": String(Math.ceil(decision.resetAt / 1000)),
    ...(decision.allowed ? {} : { "retry-after": String(decision.retryAfterSeconds) }),
  };
}

export function resetPocketBudgetsForTesting() {
  entries.clear();
}
