import OpenAI from "openai";

const OPENAI_HEALTH_TIMEOUT_MS = 5_000;

export type OpenAIHealthStatus =
  | { status: "connected" }
  | { status: "not_configured" }
  | { status: "unavailable" };

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

export async function checkOpenAIConnection(client: OpenAIHealthClient | null = createOpenAIClient()): Promise<OpenAIHealthStatus> {
  if (!client) return { status: "not_configured" };
  try {
    await client.models.list();
    return { status: "connected" };
  } catch {
    return { status: "unavailable" };
  }
}
