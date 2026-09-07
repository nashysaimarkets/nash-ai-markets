// Accounting metadata only: never log images, prompts, report text or purchase data.
export type PocketUsageOperation = "preflight" | "report" | "precision" | "precision-rescue" | "levels" | "liquidity" | "liquidity-calibration" | "follow-up" | "review";

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const count = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const label = (value: unknown): string | null => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value) ? value : null;

export function pocketUsageRecord(operation: PocketUsageOperation, response: unknown) {
  const result = object(response);
  const usage = object(result.usage);
  const inputTokens = count(usage.input_tokens);
  const cachedInputTokens = count(object(usage.input_tokens_details).cached_tokens);
  const outputTokens = count(usage.output_tokens);
  return {
    event: "pocket_ai_usage",
    operation,
    responseId: label(result.id),
    model: label(result.model),
    serviceTier: label(result.service_tier),
    status: label(result.status),
    inputTokens,
    cachedInputTokens,
    outputTokens,
    // Reasoning tokens are part of outputTokens, not an additional charge.
    reasoningTokens: count(object(usage.output_tokens_details).reasoning_tokens),
    totalTokens: count(usage.total_tokens),
    usageComplete: inputTokens !== null && cachedInputTokens !== null && outputTokens !== null && cachedInputTokens <= inputTokens,
  };
}

export async function observePocketUsage<T>(operation: PocketUsageOperation, pending: PromiseLike<T>): Promise<T> {
  try {
    const response = await pending;
    console.info("[pocket-ai-usage]", JSON.stringify(pocketUsageRecord(operation, response)));
    return response;
  } catch (error) {
    // A timeout can still incur provider charges. Missing usage is never zero.
    console.info("[pocket-ai-usage]", JSON.stringify({ ...pocketUsageRecord(operation, null), status: "request_failed" }));
    throw error;
  }
}
