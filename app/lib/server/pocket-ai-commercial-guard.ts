import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "../../../utils/supabase/admin.ts";

const DEFAULT_MONTHLY_ANALYSIS_LIMIT = 30;
const CACHE_TTL_MS = 24 * 60 * 60_000;
const MEMORY_CACHE_LIMIT = 100;

type CachedResponse = { value: Record<string, unknown>; expiresAt: number };
export type PocketAIUsageRecord = {
  stage: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

const memoryCache = new Map<string, CachedResponse>();
const previewAllowance = new Map<string, { month: string; count: number }>();

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function pocketAIEnabled() {
  return !["0", "false", "off", "disabled"].includes((process.env.POCKET_AI_ENABLED ?? "true").trim().toLowerCase());
}

export function pocketMonthlyLimit() {
  return positiveInteger(process.env.POCKET_AI_MONTHLY_LIMIT, DEFAULT_MONTHLY_ANALYSIS_LIMIT);
}

export function pocketGlobalMonthlyLimit() {
  return positiveInteger(process.env.POCKET_AI_GLOBAL_MONTHLY_LIMIT, 0);
}

export function pocketRequestIdentity(request: Request) {
  const supplied = request.headers.get("x-pocket-client-id")?.trim() ?? "";
  const stableClientId = /^[a-zA-Z0-9_-]{16,128}$/.test(supplied) ? supplied : "";
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent")?.slice(0, 160) || "unknown";
  const salt = process.env.POCKET_BUDGET_SALT?.trim() || "pocket-beta-budget-v1";
  return createHash("sha256")
    .update(`${salt}:${stableClientId ? `client:${stableClientId}` : `fallback:${address}:${userAgent}`}`)
    .digest("hex");
}

export function pocketResponseCacheKey(kind: "analysis" | "preflight", parts: Array<string | null | undefined>) {
  const hash = createHash("sha256").update(`pocket-${kind}-cache-v1\n`);
  for (const part of parts) hash.update(part ?? "").update("\n---\n");
  return hash.digest("hex");
}

function trimMemoryCache(now = Date.now()) {
  for (const [key, entry] of memoryCache) if (entry.expiresAt <= now) memoryCache.delete(key);
  while (memoryCache.size > MEMORY_CACHE_LIMIT) {
    const oldest = memoryCache.keys().next().value as string | undefined;
    if (!oldest) break;
    memoryCache.delete(oldest);
  }
}

export async function getPocketCachedResponse(cacheKey: string, kind: "analysis" | "preflight") {
  const now = Date.now();
  const local = memoryCache.get(cacheKey);
  if (local && local.expiresAt > now) return local.value;
  if (local) memoryCache.delete(cacheKey);
  try {
    const { data, error } = await createAdminClient()
      .from("pocket_ai_response_cache")
      .select("response,expires_at")
      .eq("cache_key", cacheKey)
      .eq("kind", kind)
      .gt("expires_at", new Date(now).toISOString())
      .maybeSingle();
    if (error || !data?.response || typeof data.response !== "object") return null;
    const expiresAt = Date.parse(String(data.expires_at));
    const value = data.response as Record<string, unknown>;
    if (Number.isFinite(expiresAt)) memoryCache.set(cacheKey, { value, expiresAt });
    trimMemoryCache(now);
    return value;
  } catch {
    return null;
  }
}

export async function savePocketCachedResponse(cacheKey: string, kind: "analysis" | "preflight", value: Record<string, unknown>) {
  const expiresAt = Date.now() + CACHE_TTL_MS;
  memoryCache.set(cacheKey, { value, expiresAt });
  trimMemoryCache();
  try {
    const { error } = await createAdminClient().from("pocket_ai_response_cache").upsert({
      cache_key: cacheKey,
      kind,
      response: value,
      expires_at: new Date(expiresAt).toISOString(),
      last_accessed_at: new Date().toISOString(),
    });
    if (error) console.error("[pocket-ai-cache] save unavailable", error.message);
  } catch (error) {
    console.error("[pocket-ai-cache] save unavailable", error instanceof Error ? error.message : "unknown");
  }
}

export type PocketAllowanceDecision = {
  allowed: boolean;
  reserved: boolean;
  used: number;
  remaining: number;
  limit: number;
  resetAt: string;
  reason: "allowed" | "customer_limit" | "global_limit" | "guard_unavailable";
};

export async function reservePocketMonthlyAnalysis(identityHash: string): Promise<PocketAllowanceDecision> {
  const limit = pocketMonthlyLimit();
  const globalLimit = pocketGlobalMonthlyLimit();
  const fallbackReset = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString();
  if (limit === 0 && globalLimit === 0) return { allowed: true, reserved: false, used: 0, remaining: 0, limit: 0, resetAt: fallbackReset, reason: "allowed" };
  try {
    const { data, error } = await createAdminClient().rpc("reserve_pocket_ai_analysis", {
      p_subject_hash: identityHash,
      p_subject_limit: limit,
      p_global_limit: globalLimit,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") throw new Error("Allowance guard returned no decision.");
    const allowed = row.allowed === true;
    return {
      allowed,
      reserved: allowed,
      used: Number(row.used_count ?? 0),
      remaining: Number(row.remaining_count ?? 0),
      limit,
      resetAt: typeof row.reset_at === "string" ? row.reset_at : fallbackReset,
      reason: allowed ? "allowed" : row.denial_reason === "global_limit" ? "global_limit" : "customer_limit",
    };
  } catch (error) {
    console.error("[pocket-ai-guard] monthly allowance unavailable", error instanceof Error ? error.message : "unknown");
    const failOpen = ["1", "true", "on"].includes((process.env.POCKET_AI_ALLOWANCE_FAIL_OPEN ?? "").trim().toLowerCase());
    const previewFallback = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV !== "production";
    if (previewFallback && !failOpen) {
      const month = new Date().toISOString().slice(0, 7);
      const subject = previewAllowance.get(identityHash);
      const subjectCount = subject?.month === month ? subject.count : 0;
      const global = previewAllowance.get("__global__");
      const globalCount = global?.month === month ? global.count : 0;
      if (globalLimit > 0 && globalCount >= globalLimit) return { allowed: false, reserved: false, used: subjectCount, remaining: Math.max(limit - subjectCount, 0), limit, resetAt: fallbackReset, reason: "global_limit" };
      if (limit > 0 && subjectCount >= limit) return { allowed: false, reserved: false, used: subjectCount, remaining: 0, limit, resetAt: fallbackReset, reason: "customer_limit" };
      previewAllowance.set(identityHash, { month, count: subjectCount + 1 });
      previewAllowance.set("__global__", { month, count: globalCount + 1 });
      return { allowed: true, reserved: true, used: subjectCount + 1, remaining: limit > 0 ? Math.max(limit - subjectCount - 1, 0) : 0, limit, resetAt: fallbackReset, reason: "allowed" };
    }
    return {
      allowed: failOpen,
      reserved: false,
      used: 0,
      remaining: 0,
      limit,
      resetAt: fallbackReset,
      reason: failOpen ? "allowed" : "guard_unavailable",
    };
  }
}

export async function releasePocketMonthlyAnalysis(identityHash: string) {
  const month = new Date().toISOString().slice(0, 7);
  for (const key of [identityHash, "__global__"]) {
    const entry = previewAllowance.get(key);
    if (entry?.month === month) previewAllowance.set(key, { month, count: Math.max(0, entry.count - 1) });
  }
  try {
    const { error } = await createAdminClient().rpc("release_pocket_ai_analysis", { p_subject_hash: identityHash });
    if (error) console.error("[pocket-ai-guard] allowance release unavailable", error.message);
  } catch (error) {
    console.error("[pocket-ai-guard] allowance release unavailable", error instanceof Error ? error.message : "unknown");
  }
}

export function pocketAIUsageRecord(stage: string, model: string, response: unknown): PocketAIUsageRecord | null {
  const usage = response && typeof response === "object" && "usage" in response
    ? (response as { usage?: { input_tokens?: unknown; output_tokens?: unknown; total_tokens?: unknown } }).usage
    : null;
  if (!usage) return null;
  return {
    stage,
    model,
    inputTokens: typeof usage.input_tokens === "number" ? usage.input_tokens : null,
    outputTokens: typeof usage.output_tokens === "number" ? usage.output_tokens : null,
    totalTokens: typeof usage.total_tokens === "number" ? usage.total_tokens : null,
  };
}

export async function recordPocketAIUsage(identityHash: string, requestId: string, cacheHit: boolean, records: PocketAIUsageRecord[], outcome: string) {
  if (!records.length && !cacheHit) return;
  const rows = records.length ? records.map((record) => ({
    request_id: requestId,
    subject_hash: identityHash,
    stage: record.stage,
    model: record.model,
    input_tokens: record.inputTokens,
    output_tokens: record.outputTokens,
    total_tokens: record.totalTokens,
    cache_hit: cacheHit,
    outcome,
  })) : [{
    request_id: requestId,
    subject_hash: identityHash,
    stage: "cache",
    model: "none",
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    cache_hit: true,
    outcome,
  }];
  try {
    const { error } = await createAdminClient().from("pocket_ai_usage_events").insert(rows);
    if (error) console.error("[pocket-ai-usage] persistence unavailable", error.message);
  } catch (error) {
    console.error("[pocket-ai-usage] persistence unavailable", error instanceof Error ? error.message : "unknown");
  }
}

export function pocketRequestId() {
  return randomUUID();
}

export function resetPocketAIGuardsForTesting() {
  memoryCache.clear();
  previewAllowance.clear();
}
