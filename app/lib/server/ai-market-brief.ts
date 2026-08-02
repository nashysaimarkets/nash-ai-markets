import type { MarketBriefSelection } from "../market-brief.ts";
import { createOpenAIClient } from "./openai.ts";

const AI_BRIEF_TIMEOUT_MS = 4_000;

export type AIMarketBriefInput = {
  marketBias: "bullish" | "neutral" | "bearish";
  tradePermission: "actionable" | "caution" | "no-trade";
  riskRating: "low" | "medium" | "high" | "extreme";
  confidence: number;
  availableDrivers: string[];
  availableRisks: string[];
};

export type AIMarketBriefResult =
  | { status: "generated"; selection: MarketBriefSelection }
  | { status: "not_configured" | "unavailable" | "invalid_response"; selection: null };

type BriefClient = {
  responses: {
    create: (
      body: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ) => Promise<{ output_text: string }>;
  };
};

function isSelection(value: unknown, input: AIMarketBriefInput): value is MarketBriefSelection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MarketBriefSelection>;
  return (
    (candidate.emphasis === "aligned" || candidate.emphasis === "mixed" || candidate.emphasis === "defensive")
    && Array.isArray(candidate.focusDrivers)
    && candidate.focusDrivers.length > 0
    && candidate.focusDrivers.length <= 3
    && candidate.focusDrivers.every((driver) => typeof driver === "string" && input.availableDrivers.includes(driver))
    && typeof candidate.primaryRisk === "string"
    && (candidate.primaryRisk === "NONE" || input.availableRisks.includes(candidate.primaryRisk))
  );
}

export async function generateAIMarketBriefSelection(
  input: AIMarketBriefInput,
  client: BriefClient | null = createOpenAIClient() as BriefClient | null,
  model = process.env.OPENAI_BRIEF_MODEL?.trim(),
): Promise<AIMarketBriefResult> {
  if (!client || !model || input.availableDrivers.length === 0) {
    console.warn(
      `[ai-market-brief] not_configured ${JSON.stringify({
        client: Boolean(client),
        briefModelConfigured: Boolean(model),
        availableDrivers: input.availableDrivers.length,
      })}`,
    );
    return { status: "not_configured", selection: null };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_BRIEF_TIMEOUT_MS);
  try {
    const response = await client.responses.create({
      model,
      instructions: [
        "Prioritize only the supplied deterministic Bullseye evidence.",
        "Do not create prose, prices, levels, entries, stops, targets, forecasts, or personalized advice.",
        "Return only the requested structured selection.",
      ].join(" "),
      input: JSON.stringify(input),
      max_output_tokens: 180,
      text: {
        format: {
          type: "json_schema",
          name: "bullseye_market_brief_selection",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              emphasis: { type: "string", enum: ["aligned", "mixed", "defensive"] },
              focusDrivers: {
                type: "array",
                minItems: 1,
                maxItems: 3,
                items: { type: "string", enum: input.availableDrivers },
              },
              primaryRisk: {
                type: "string",
                enum: ["NONE", ...input.availableRisks],
              },
            },
            required: ["emphasis", "focusDrivers", "primaryRisk"],
          },
        },
      },
    }, { signal: controller.signal });
    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      console.warn("[ai-market-brief] invalid_response: output was not JSON");
      return { status: "invalid_response", selection: null };
    }
    if (!isSelection(parsed, input)) {
      console.warn("[ai-market-brief] invalid_response: output failed selection validation");
      return { status: "invalid_response", selection: null };
    }
    return { status: "generated", selection: parsed };
  } catch (error) {
    const aborted = controller.signal.aborted;
    console.error(
      `[ai-market-brief] unavailable ${JSON.stringify({
        timedOut: aborted,
        timeoutMs: AI_BRIEF_TIMEOUT_MS,
        error: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      })}`,
    );
    return { status: "unavailable", selection: null };
  } finally {
    clearTimeout(timeout);
  }
}
