import { createAdminClient } from "../../../utils/supabase/admin.ts";
import { createClient } from "../../../utils/supabase/server.ts";
import {
  buildAnalysisSnapshot,
  type AnalysisSnapshotPayload,
  type SnapshotKind,
  type StoredAnalysisSnapshot,
} from "../market-analysis-snapshot.ts";
import type { MarketSnapshot } from "../market-data.ts";
import type { MarketIntelligence } from "../market-intelligence-engine.ts";
import type { TradingDecision } from "../trading-decision-engine.ts";
import type { TradePlan } from "../structured-trade-planner.ts";
import type { MarketGatewayStatus } from "../live-market-gateway.ts";

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return message.includes("market_analysis_snapshots") && (message.includes("does not exist") || message.includes("42p01") || message.includes("schema cache"));
}

export async function persistAnalysisSnapshot(input: {
  snapshot: MarketSnapshot;
  intelligence: MarketIntelligence;
  decision: TradingDecision;
  plan: TradePlan;
  gateway: MarketGatewayStatus;
  kind?: SnapshotKind;
  candleRefs?: AnalysisSnapshotPayload["candleRefs"];
  generationMode?: "deterministic" | "ai-assisted";
}): Promise<{ stored: boolean; reason: string; id?: string }> {
  try {
    const built = buildAnalysisSnapshot(input);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("market_analysis_snapshots")
      .upsert(built.row, { onConflict: "session_date,kind,content_hash", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (error) {
      if (isMissingRelation(error)) return { stored: false, reason: "migration_pending" };
      return { stored: false, reason: "persist_failed" };
    }
    return { stored: true, reason: data?.id ? "inserted" : "duplicate", id: data?.id };
  } catch {
    return { stored: false, reason: "unavailable" };
  }
}

export async function listAnalysisSnapshots(limit = 60): Promise<{ rows: StoredAnalysisSnapshot[]; available: boolean; reason?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("market_analysis_snapshots")
      .select("*")
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingRelation(error)) return { rows: [], available: false, reason: "migration_pending" };
      return { rows: [], available: false, reason: "query_failed" };
    }
    return { rows: (data ?? []) as StoredAnalysisSnapshot[], available: true };
  } catch {
    return { rows: [], available: false, reason: "unavailable" };
  }
}

export async function getLatestSnapshotForDate(sessionDate: string): Promise<StoredAnalysisSnapshot | null> {
  const { rows, available } = await listAnalysisSnapshots(120);
  if (!available) return null;
  return rows.find((row) => row.session_date === sessionDate) ?? null;
}

export async function getPreviousDaySnapshot(relativeToIso = new Date().toISOString()): Promise<StoredAnalysisSnapshot | null> {
  const day = new Date(relativeToIso);
  day.setUTCDate(day.getUTCDate() - 1);
  const target = day.toISOString().slice(0, 10);
  return getLatestSnapshotForDate(target);
}

export async function getPriorSnapshot(beforeIso: string): Promise<StoredAnalysisSnapshot | null> {
  const { rows, available } = await listAnalysisSnapshots(40);
  if (!available) return null;
  const before = Date.parse(beforeIso);
  return rows.find((row) => Date.parse(row.created_at) < before) ?? null;
}

export async function firstCompleteSnapshotDate(): Promise<string | null> {
  const { rows, available } = await listAnalysisSnapshots(200);
  if (!available || !rows.length) return null;
  return rows[rows.length - 1]?.session_date ?? null;
}
