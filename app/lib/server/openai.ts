import OpenAI from "openai";

const OPENAI_HEALTH_TIMEOUT_MS = 5_000;
export const OPENAI_DEFAULT_MODEL = "gpt-5-mini";

export type OpenAIHealthStatus =
  | { status: "connected"; reason: null }
  | { status: "not_configured"; reason: "missing_api_key" }
  | {
    status: "unavailable";
    reason: "authentication_rejected" | "quota_exhausted" | "rate_limited" | "model_unavailable" | "permission_denied" | "timeout" | "provider_unavailable";
  };

type OpenAIHealthClient = {
  responses: {
    create: (body: Record<string, unknown>) => Promise<unknown>;
  };
};

export function createOpenAIClient(apiKey = process.env.OPENAI_API_KEY): OpenAI | null {
  if (!apiKey?.trim()) return null;
  return new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: OPENAI_HEALTH_TIMEOUT_MS,
  });
}

function safeFailureReason(error: unknown): Extract<OpenAIHealthStatus, { status: "unavailable" }>["reason"] {
  if (!error || typeof error !== "object") return "provider_unavailable";
  const candidate = error as { status?: unknown; code?: unknown; name?: unknown };
  if (candidate.status === 401 || candidate.code === "invalid_api_key") return "authentication_rejected";
  if (candidate.code === "insufficient_quota") return "quota_exhausted";
  if (candidate.status === 403 || candidate.code === "permission_denied") return "permission_denied";
  if (candidate.status === 404 || candidate.code === "model_not_found") return "model_unavailable";
  if (candidate.status === 429 || candidate.code === "rate_limit_exceeded") return "rate_limited";
  if (candidate.name === "AbortError" || candidate.code === "ETIMEDOUT") return "timeout";
  return "provider_unavailable";
}

export async function checkOpenAIConnection(
  client: OpenAIHealthClient | null = createOpenAIClient(),
  model = process.env.OPENAI_MORNING_BRIEF_MODEL?.trim()
    || process.env.OPENAI_BRIEF_MODEL?.trim()
    || OPENAI_DEFAULT_MODEL,
): Promise<OpenAIHealthStatus> {
  if (!client) return { status: "not_configured", reason: "missing_api_key" };
  try {
    await client.responses.create({
      model,
      store: false,
      input: "Reply with OK only.",
      max_output_tokens: 16,
    });
    return { status: "connected", reason: null };
  } catch (error) {
    return { status: "unavailable", reason: safeFailureReason(error) };
  }
}
