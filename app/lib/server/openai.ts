import OpenAI from "openai";

const OPENAI_HEALTH_TIMEOUT_MS = 5_000;

export type OpenAIHealthStatus =
  | { status: "connected"; reason: null }
  | { status: "not_configured"; reason: "missing_api_key" }
  | {
    status: "unavailable";
    reason: "authentication_rejected" | "rate_limited" | "timeout" | "provider_unavailable";
  };

type OpenAIHealthClient = {
  models: {
    list: () => Promise<unknown>;
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
  if (candidate.status === 429 || candidate.code === "rate_limit_exceeded" || candidate.code === "insufficient_quota") return "rate_limited";
  if (candidate.name === "AbortError" || candidate.code === "ETIMEDOUT") return "timeout";
  return "provider_unavailable";
}

export async function checkOpenAIConnection(client: OpenAIHealthClient | null = createOpenAIClient()): Promise<OpenAIHealthStatus> {
  if (!client) return { status: "not_configured", reason: "missing_api_key" };
  try {
    await client.models.list();
    return { status: "connected", reason: null };
  } catch (error) {
    return { status: "unavailable", reason: safeFailureReason(error) };
  }
}
