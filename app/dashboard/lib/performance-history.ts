import { createAdminClient } from "../../../utils/supabase/admin.ts";
import { createAsyncTtlCache } from "../../lib/server/async-ttl-cache.ts";

export type VerifiedOutcome = {
  predicted_bias: "bullish" | "neutral" | "bearish";
  actual_bias: "bullish" | "neutral" | "bearish";
  snapshot_as_of: string;
  verified_at: string;
  verification_source: string;
};

export type AccuracySummary =
  | { status: "verified"; sampleSize: number; correct: number; accuracyPercent: number; latestVerifiedAt: string }
  | { status: "insufficient"; sampleSize: number; required: number }
  | { status: "unavailable"; sampleSize: 0 };

const accuracySummaryCache = createAsyncTtlCache<AccuracySummary>({
  ttlMs: 5 * 60_000,
  failureTtlMs: 15_000,
  isFailure: (summary) => summary.status === "unavailable",
});

export function summarizeVerifiedOutcomes(outcomes: readonly VerifiedOutcome[], minimumSample = 20): AccuracySummary {
  const verified = outcomes.filter((outcome) =>
    ["bullish", "neutral", "bearish"].includes(outcome.predicted_bias) &&
    ["bullish", "neutral", "bearish"].includes(outcome.actual_bias) &&
    Number.isFinite(Date.parse(outcome.snapshot_as_of)) &&
    Number.isFinite(Date.parse(outcome.verified_at)) &&
    outcome.verification_source.trim().length > 0,
  );
  if (verified.length < minimumSample) return { status: "insufficient", sampleSize: verified.length, required: minimumSample };
  const correct = verified.filter((outcome) => outcome.predicted_bias === outcome.actual_bias).length;
  const latestVerifiedAt = verified.reduce(
    (latest, outcome) => Date.parse(outcome.verified_at) > Date.parse(latest) ? outcome.verified_at : latest,
    verified[0]!.verified_at,
  );
  return { status: "verified", sampleSize: verified.length, correct, accuracyPercent: Math.round((correct / verified.length) * 1_000) / 10, latestVerifiedAt };
}

export async function loadAccuracySummary(): Promise<AccuracySummary> {
  return accuracySummaryCache.get(async () => {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.from("bullseye_verified_outcomes")
        .select("predicted_bias, actual_bias, snapshot_as_of, verified_at, verification_source")
        .order("verified_at", { ascending: false })
        .limit(500);
      if (error) return { status: "unavailable", sampleSize: 0 };
      return summarizeVerifiedOutcomes((data ?? []) as VerifiedOutcome[]);
    } catch {
      return { status: "unavailable", sampleSize: 0 };
    }
  });
}
