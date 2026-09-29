type Usage = { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number }; output_tokens_details?: { reasoning_tokens?: number } };
export type ScanOutcome = "completed" | "inconclusive" | "failed";

/** Metadata only: never include screenshots, prompts, prices or customer identity. */
export function createScanMetrics(chartCount: number, emit: (record: Record<string, unknown>) => void, now = Date.now) {
  const started = now();
  const scanId = crypto.randomUUID();
  const calls: Array<{ phase: string; model: string; serviceTier: string; inputTokens: number; cachedInputTokens: number; outputTokens: number; reasoningTokens: number }> = [];
  const milestones: Record<string, number> = {};
  let finished = false;
  return {
    scanId,
    mark(phase: "context_ready" | "report_started" | "first_output" | "report_ready" | "precision_ready" | "validated") {
      if (milestones[phase] === undefined) milestones[phase] = Math.max(0, now() - started);
    },
    timingHeader() {
      return [`total;dur=${Math.max(0, now() - started)}`, ...Object.entries(milestones).map(([name, duration]) => `${name};dur=${duration}`)].join(", ");
    },
    usage(phase: string, model: string, usage: Usage | undefined, serviceTier = "default") {
      const count = (n: number | undefined) => Number.isFinite(n) && n! >= 0 ? n! : 0;
      calls.push({ phase, model, serviceTier, inputTokens: count(usage?.input_tokens), cachedInputTokens: count(usage?.input_tokens_details?.cached_tokens), outputTokens: count(usage?.output_tokens), reasoningTokens: count(usage?.output_tokens_details?.reasoning_tokens) });
    },
    finish(outcome: ScanOutcome, failure: string | null = null) {
      if (finished) return;
      finished = true;
      emit({ event: "pocket_scan", scanId, chartCount, outcome, failure, elapsedMs: Math.max(0, now() - started), milestones: { ...milestones }, providerResponses: calls.length, inputTokens: calls.reduce((sum, c) => sum + c.inputTokens, 0), cachedInputTokens: calls.reduce((sum, c) => sum + c.cachedInputTokens, 0), outputTokens: calls.reduce((sum, c) => sum + c.outputTokens, 0), calls, costStatus: "Apply current provider prices; usage for requests without a response may be unavailable." });
    },
  };
}
