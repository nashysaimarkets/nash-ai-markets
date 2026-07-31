import { createClient } from "../../../utils/supabase/server.ts";
import { journalPerformance } from "../journal-performance.ts";

export { journalPerformance };

export type JournalEntryInput = {
  tradedAt: string;
  instrumentClass: "futures" | "options";
  underlying: string;
  direction: "long" | "short" | "neutral";
  entryPrice?: number | null;
  stopPrice?: number | null;
  targetPrice?: number | null;
  positionSize?: string | null;
  optionsStrategy?: string | null;
  expiry?: string | null;
  strikes?: string | null;
  plannedMaxRisk?: string | null;
  exitPrice?: number | null;
  pnl?: number | null;
  notes?: string | null;
  reason?: string | null;
  emotion?: string | null;
  followedPlan?: boolean | null;
  respectedConfirmation?: boolean | null;
  respectedInvalidation?: boolean | null;
  eventExposure?: string | null;
  lesson?: string | null;
  bullseyeScore?: number | null;
  vixRegime?: string | null;
};

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return message.includes("member_trade_journal") && (message.includes("does not exist") || message.includes("42p01") || message.includes("schema cache"));
}

function toRow(userId: string, input: JournalEntryInput) {
  return {
    user_id: userId,
    traded_at: input.tradedAt,
    instrument_class: input.instrumentClass,
    underlying: input.underlying.trim(),
    direction: input.direction,
    entry_price: input.entryPrice ?? null,
    stop_price: input.stopPrice ?? null,
    target_price: input.targetPrice ?? null,
    position_size: input.positionSize ?? null,
    options_strategy: input.optionsStrategy ?? null,
    expiry: input.expiry ?? null,
    strikes: input.strikes ?? null,
    planned_max_risk: input.plannedMaxRisk ?? null,
    exit_price: input.exitPrice ?? null,
    pnl: input.pnl ?? null,
    notes: input.notes ?? null,
    reason: input.reason ?? null,
    emotion: input.emotion ?? null,
    followed_plan: input.followedPlan ?? null,
    respected_confirmation: input.respectedConfirmation ?? null,
    respected_invalidation: input.respectedInvalidation ?? null,
    event_exposure: input.eventExposure ?? null,
    lesson: input.lesson ?? null,
    bullseye_score: input.bullseyeScore ?? null,
    vix_regime: input.vixRegime ?? null,
    privacy: "private",
    updated_at: new Date().toISOString(),
  };
}

export async function listJournalEntries(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_trade_journal")
    .select("*")
    .eq("user_id", userId)
    .order("traded_at", { ascending: false })
    .limit(200);
  if (error) {
    if (isMissingRelation(error)) return { rows: [], available: false as const, reason: "migration_pending" };
    return { rows: [], available: false as const, reason: "query_failed" };
  }
  return { rows: data ?? [], available: true as const };
}

export async function createJournalEntry(userId: string, input: JournalEntryInput) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("member_trade_journal").insert(toRow(userId, input)).select("*").single();
  if (error) {
    if (isMissingRelation(error)) return { ok: false as const, reason: "migration_pending" };
    return { ok: false as const, reason: "persist_failed" };
  }
  return { ok: true as const, row: data };
}

export async function updateJournalEntry(userId: string, id: string, input: JournalEntryInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_trade_journal")
    .update(toRow(userId, input))
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return { ok: false as const, reason: "migration_pending" };
    return { ok: false as const, reason: "persist_failed" };
  }
  return data ? { ok: true as const, row: data } : { ok: false as const, reason: "not_found" };
}

export async function deleteJournalEntry(userId: string, id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("member_trade_journal").delete().eq("id", id).eq("user_id", userId);
  if (error) {
    if (isMissingRelation(error)) return { ok: false as const, reason: "migration_pending" };
    return { ok: false as const, reason: "persist_failed" };
  }
  return { ok: true as const };
}
