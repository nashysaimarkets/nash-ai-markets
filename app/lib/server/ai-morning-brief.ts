import type { MorningBrief } from "../morning-brief-engine.ts";
import { createAsyncKeyedTtlCache } from "./async-ttl-cache.ts";
import { createOpenAIClient, OPENAI_DEFAULT_MODEL } from "./openai.ts";

const AI_MORNING_BRIEF_TIMEOUT_MS = 5_000;
export const DEFAULT_MORNING_BRIEF_MODEL = OPENAI_DEFAULT_MODEL;

export type AIMorningBriefContent = {
  headline: string;
  summary: string;
  priorities: string[];
};

export type AIMorningBriefResult =
  | { status: "generated"; content: AIMorningBriefContent }
  | {
    status: "not_configured" | "quota_exhausted" | "rate_limited" | "timeout" | "unavailable" | "invalid_response";
    content: null;
  };

type MorningBriefClient = {
  responses: {
    create: (
      body: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ) => Promise<{ output_text: string }>;
  };
};

const aiMorningBriefCache = createAsyncKeyedTtlCache<AIMorningBriefResult>({
  ttlMs: 10 * 60_000,
  maxEntries: 12,
  isFailure: (result) => result.status !== "generated",
});

function safeFailureStatus(error: unknown): Exclude<AIMorningBriefResult["status"], "generated" | "not_configured" | "invalid_response"> {
  if (!error || typeof error !== "object") return "unavailable";
  const candidate = error as { status?: unknown; code?: unknown; name?: unknown };
  if (candidate.code === "insufficient_quota") return "quota_exhausted";
  if (candidate.status === 429 || candidate.code === "rate_limit_exceeded") {
    return "rate_limited";
  }
  if (candidate.name === "AbortError" || candidate.code === "ETIMEDOUT") return "timeout";
  return "unavailable";
}

function isSafeText(value: unknown, maxLength: number): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return false;
  return !/\b(?:entry|stop(?:-loss)?|target|support|resistance|expected move|guarantee|certain|buy|sell)\b/i.test(normalized)
    && !/(?:£|\$|€)\s?\d|\b\d{3,}(?:[.,]\d+)?\b/.test(normalized);
}

function isValidContent(value: unknown, brief: MorningBrief): value is AIMorningBriefContent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AIMorningBriefContent>;
  return isSafeText(candidate.headline, 100)
    && isSafeText(candidate.summary, 320)
    && Array.isArray(candidate.priorities)
    && candidate.priorities.length === brief.priorities.length
    && candidate.priorities.every((priority) => typeof priority === "string" && brief.priorities.includes(priority))
    && new Set(candidate.priorities).size === brief.priorities.length;
}

export async function generateAIMorningBrief(
  brief: MorningBrief,
  client?: MorningBriefClient | null,
  model = process.env.OPENAI_MORNING_BRIEF_MODEL?.trim()
    || process.env.OPENAI_BRIEF_MODEL?.trim()
    || DEFAULT_MORNING_BRIEF_MODEL,
): Promise<AIMorningBriefResult> {
  const configuredClient = client === undefined
    ? createOpenAIClient() as MorningBriefClient | null
    : client;
  if (brief.mode !== "verified" || !brief.actionable || !configuredClient || !model) {
    return { status: "not_configured", content: null };
  }

  const generate = async (): Promise<AIMorningBriefResult> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_MORNING_BRIEF_TIMEOUT_MS);
    try {
      const response = await configuredClient.responses.create({
      model,
      instructions: [
        "Write a concise executive morning market summary using only the supplied verified Bullseye fields.",
        "Do not add facts, prices, levels, forecasts, entries, stops, targets, recommendations, certainty, or personalised advice.",
        "Do not change or add priorities; return every supplied priority exactly once, ordered by importance.",
        "Use restrained professional language and acknowledge uncertainty.",
      ].join(" "),
      input: JSON.stringify({
        sessionLabel: brief.sessionLabel,
        marketCondition: brief.headline,
        confidence: brief.confidence,
        directionalContext: brief.directionalBias,
        priorities: brief.priorities,
        checklist: brief.checklist,
      }),
      max_output_tokens: 260,
      text: {
        format: {
          type: "json_schema",
          name: "bullseye_morning_brief",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              headline: { type: "string", minLength: 1, maxLength: 100 },
              summary: { type: "string", minLength: 1, maxLength: 320 },
              priorities: {
                type: "array",
                minItems: brief.priorities.length,
                maxItems: brief.priorities.length,
                items: { type: "string", enum: brief.priorities },
              },
            },
            required: ["headline", "summary", "priorities"],
          },
        },
      },
      }, { signal: controller.signal });

      let parsed: unknown;
      try {
        parsed = JSON.parse(response.output_text);
      } catch {
        return { status: "invalid_response", content: null };
      }
      return isValidContent(parsed, brief)
        ? {
          status: "generated",
          content: {
            headline: parsed.headline.trim(),
            summary: parsed.summary.trim(),
            priorities: parsed.priorities,
          },
        }
        : { status: "invalid_response", content: null };
    } catch (error) {
      return { status: safeFailureStatus(error), content: null };
    } finally {
      clearTimeout(timeout);
    }
  };

  if (client !== undefined) return generate();
  return aiMorningBriefCache.get(JSON.stringify({ model, brief }), generate);
}
