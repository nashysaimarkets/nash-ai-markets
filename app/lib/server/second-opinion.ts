import { createOpenAIClient, OPENAI_DEFAULT_MODEL } from "./openai.ts";

const SECOND_OPINION_TIMEOUT_MS = 30_000;
export const SECOND_OPINION_MODEL = process.env.OPENAI_SECOND_OPINION_MODEL?.trim() || OPENAI_DEFAULT_MODEL;

export type SecondOpinionInput = {
  market: string;
  timeframe: string;
  currentPrice: number | null;
  direction: "long" | "short" | "neutral";
  entry: number | null;
  stop: number | null;
  target: number | null;
  stake: string;
  emotion: string;
  thesis: string;
  imageDataUrl: string;
};

export type SecondOpinionContent = {
  chartReadability: "clear" | "partial" | "unreadable";
  directionalLean: "bullish" | "bearish" | "neutral";
  summary: string;
  observations: string[];
  bullCase: string;
  bearCase: string;
  invalidation: string;
  noTradeReasons: string[];
  disciplineCheck: string;
  uncertainties: string[];
  visualGuides: Array<{
    tool: "support" | "resistance" | "trend";
    yPercent: number;
    label: string;
    confidence: "low" | "medium" | "high";
  }>;
  riskReward: number | null;
  extracted: {
    market: string | null;
    timeframe: "1m" | "5m" | "15m" | "1h" | "4h" | "daily" | null;
    platform: string | null;
    visiblePrice: number | null;
    intendedDirection: "long" | "short" | "neutral";
    entry: number | null;
    stop: number | null;
    target: number | null;
    indicators: string[];
    confidence: "low" | "medium" | "high";
    confirmationNeeded: string[];
  };
};

export type SecondOpinionResult =
  | { status: "generated"; content: SecondOpinionContent }
  | { status: "not_configured" | "quota_exhausted" | "rate_limited" | "timeout" | "unavailable" | "invalid_response"; content: null };

function calculatedRiskReward(input: SecondOpinionInput): number | null {
  if (input.entry == null || input.stop == null || input.target == null) return null;
  const risk = Math.abs(input.entry - input.stop);
  const reward = Math.abs(input.target - input.entry);
  if (!Number.isFinite(risk) || !Number.isFinite(reward) || risk <= 0) return null;
  return Math.round((reward / risk) * 100) / 100;
}

function calculatedExtractedRiskReward(
  input: SecondOpinionInput,
  extracted: SecondOpinionContent["extracted"],
): number | null {
  return calculatedRiskReward({
    ...input,
    entry: input.entry ?? extracted.entry,
    stop: input.stop ?? extracted.stop,
    target: input.target ?? extracted.target,
  });
}

/** Cost-free fail-closed plan check used while screenshot interpretation is disabled. */
export function buildProtectedPlanCheck(input: SecondOpinionInput): SecondOpinionContent {
  const ratio = calculatedRiskReward(input);
  const hasBoundaries = input.entry != null && input.stop != null && input.target != null;
  const emotionalPause = ["impatient", "recovering-loss", "fomo", "fearful"].includes(input.emotion);
  const directionMismatch = input.direction === "long" && input.entry != null && input.stop != null && input.target != null
    ? input.stop >= input.entry || input.target <= input.entry
    : input.direction === "short" && input.entry != null && input.stop != null && input.target != null
      ? input.stop <= input.entry || input.target >= input.entry
      : false;
  const noTradeReasons = [
    !hasBoundaries ? "Entry, stop and target are not all defined, so the plan is incomplete." : null,
    directionMismatch ? "The stated stop or target does not sit logically around the entry for the intended direction." : null,
    ratio != null && ratio < 1 ? "The stated potential reward is smaller than the stated risk." : null,
    emotionalPause ? "The selected emotional state is a reason to pause before making an irreversible decision." : null,
    "The screenshot has not been machine-interpreted in protected plan-check mode.",
    "Live price, liquidity, spread and scheduled-event conditions have not been verified.",
  ].filter((item): item is string => Boolean(item)).slice(0, 5);
  while (noTradeReasons.length < 2) noTradeReasons.push("The plan may be missing context outside the submitted screenshot.");
  return {
    chartReadability: "unreadable",
    directionalLean: "neutral",
    summary: "Bullseye completed the cost-free plan and discipline check. AI chart interpretation remains disabled, so no chart pattern or directional conclusion has been claimed.",
    observations: [
      "A private screenshot was accepted but not retained or machine-interpreted in this protected mode.",
      hasBoundaries ? "The plan includes a stated entry, stop and target." : "The plan does not yet include every risk boundary.",
    ],
    bullCase: "A bullish interpretation would still require the customer to identify visible confirmation and decide independently whether the stated risk boundary is appropriate.",
    bearCase: "A bearish interpretation would still require the customer to identify visible confirmation and decide independently whether the stated risk boundary is appropriate.",
    invalidation: input.stop == null
      ? "No stop was supplied. Bullseye has not invented one; define what would prove the plan wrong before considering action."
      : "Your stated stop is the only recorded invalidation level. Bullseye has not verified or replaced it.",
    noTradeReasons,
    disciplineCheck: emotionalPause
      ? "Your selected emotional state increases decision risk. Step away and reassess when the urge to act has reduced."
      : "The recorded emotional state does not remove trading risk. Recheck the thesis, boundaries and event calendar before deciding.",
    uncertainties: [
      "No live market feed, broker conditions or economic-event status was used.",
      "A single screenshot cannot show all relevant market context.",
    ],
    visualGuides: [],
    riskReward: ratio,
    extracted: {
      market: input.market || null,
      timeframe: (["1m", "5m", "15m", "1h", "4h", "daily"] as const).includes(input.timeframe as never)
        ? input.timeframe as SecondOpinionContent["extracted"]["timeframe"]
        : null,
      platform: null,
      visiblePrice: input.currentPrice,
      intendedDirection: input.direction,
      entry: input.entry,
      stop: input.stop,
      target: input.target,
      indicators: [],
      confidence: "low",
      confirmationNeeded: ["AI Auto-Read requires activation before chart details can be extracted."],
    },
  };
}

type SecondOpinionClient = {
  responses: {
    create: (body: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<{ output_text: string }>;
  };
};

function safeFailure(error: unknown): Exclude<SecondOpinionResult["status"], "generated" | "not_configured" | "invalid_response"> {
  if (!error || typeof error !== "object") return "unavailable";
  const candidate = error as { status?: unknown; code?: unknown; name?: unknown };
  if (candidate.code === "insufficient_quota") return "quota_exhausted";
  if (candidate.status === 429 || candidate.code === "rate_limit_exceeded") return "rate_limited";
  if (candidate.name === "AbortError" || candidate.name === "APIConnectionTimeoutError" || candidate.code === "ETIMEDOUT") return "timeout";
  return "unavailable";
}

function safeText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && Boolean(value.trim()) && value.trim().length <= maxLength;
}

function safeList(value: unknown, min: number, max: number, itemMax: number): value is string[] {
  return Array.isArray(value)
    && value.length >= min
    && value.length <= max
    && value.every((item) => safeText(item, itemMax));
}

function validContent(value: unknown): value is Omit<SecondOpinionContent, "riskReward"> {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SecondOpinionContent>;
  const extracted = item.extracted;
  const validNullableText = (candidate: unknown, max: number) => candidate === null
    || (typeof candidate === "string" && candidate.trim().length <= max);
  const validNullableNumber = (candidate: unknown) => candidate === null || (typeof candidate === "number" && Number.isFinite(candidate));
  return (item.chartReadability === "clear" || item.chartReadability === "partial" || item.chartReadability === "unreadable")
    && (item.directionalLean === "bullish" || item.directionalLean === "bearish" || item.directionalLean === "neutral")
    && safeText(item.summary, 240)
    && safeList(item.observations, 1, 4, 220)
    && safeText(item.bullCase, 280)
    && safeText(item.bearCase, 280)
    && safeText(item.invalidation, 240)
    && safeList(item.noTradeReasons, 2, 5, 180)
    && safeText(item.disciplineCheck, 260)
    && safeList(item.uncertainties, 1, 4, 180)
    && Array.isArray(item.visualGuides)
    && item.visualGuides.length <= 6
    && item.visualGuides.every((guide) => Boolean(guide)
      && typeof guide === "object"
      && (guide.tool === "support" || guide.tool === "resistance" || guide.tool === "trend")
      && typeof guide.yPercent === "number"
      && Number.isFinite(guide.yPercent)
      && guide.yPercent >= 5
      && guide.yPercent <= 95
      && safeText(guide.label, 28)
      && (guide.confidence === "low" || guide.confidence === "medium" || guide.confidence === "high"))
    && Boolean(extracted && typeof extracted === "object")
    && validNullableText(extracted?.market, 32)
    && (extracted?.timeframe === null || ["1m", "5m", "15m", "1h", "4h", "daily"].includes(String(extracted?.timeframe)))
    && validNullableText(extracted?.platform, 48)
    && validNullableNumber(extracted?.visiblePrice)
    && (extracted?.intendedDirection === "long" || extracted?.intendedDirection === "short" || extracted?.intendedDirection === "neutral")
    && validNullableNumber(extracted?.entry)
    && validNullableNumber(extracted?.stop)
    && validNullableNumber(extracted?.target)
    && safeList(extracted?.indicators, 0, 8, 48)
    && (extracted?.confidence === "low" || extracted?.confidence === "medium" || extracted?.confidence === "high")
    && safeList(extracted?.confirmationNeeded, 0, 6, 140);
}

export async function generateSecondOpinion(
  input: SecondOpinionInput,
  client: SecondOpinionClient | null = createOpenAIClient(undefined, SECOND_OPINION_TIMEOUT_MS) as SecondOpinionClient | null,
  model = SECOND_OPINION_MODEL,
): Promise<SecondOpinionResult> {
  if (!client || !model) return { status: "not_configured", content: null };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SECOND_OPINION_TIMEOUT_MS);
  try {
    const response = await client.responses.create({
      model,
      store: false,
      reasoning: { effort: "low" },
      instructions: [
        "You are Bullseye Second Opinion, an educational pre-trade process checker.",
        "Describe only chart structure visibly supported by the supplied screenshot and the user's stated plan.",
        "Never issue BUY, SELL, HOLD, ENTER or EXIT commands. Never claim a live price, forecast success, give a probability, guarantee an outcome, or present personalised financial advice.",
        "Do not invent exact price levels. You may repeat entry, stop, target or current price only when supplied by the user.",
        "When a structural support, resistance or trend guide is clearly visible, you may return a visualGuide with its approximate vertical screenshot position from 5 to 95 percent. These are visual overlays only: use no exact price in the label, omit uncertain guides, and return at most six.",
        "Extract market, timeframe, platform, visible price, intended direction, entry, stop, target and indicators when they are explicitly visible and legible in the screenshot. Use null when uncertain; never estimate a price from pixel position.",
        "The intended direction must be neutral unless the screenshot or user text explicitly indicates long or short. Account risk, stake and emotion cannot be inferred from a chart.",
        "DirectionalLean is your chart reading, not the user's intended direction. Judge the immediate structure at the right edge first: recent impulse, rejection, break, reclaim, and whether price is holding or failing the nearest visible level. Use bullish or bearish when the right-edge evidence clearly leans that way; use neutral only when evidence is genuinely balanced or unreadable.",
        "Do not let an older broad trend override a sharp contrary move at the right edge. State the older trend as context, but weight immediate momentum more heavily in directionalLean and summary.",
        "Automatic visualGuides must be horizontal support or resistance only. Return no diagonal trend guide. Return at most the nearest credible support and nearest credible resistance, only where a visible reaction or repeated test supports the placement. yPercent is the vertical position across the entire supplied screenshot. Do not label a level as current price unless the line crosses the visible current-price marker.",
        "Before omitting support or resistance, scan the full visible candle history for repeated reactions, rejection wicks, consolidation boundaries, prior swing turns, and breakout-retest structure. When clear evidence exists on both sides of price, return both the nearest support and nearest resistance; do not require a second timeframe merely to report structure already visible in this screenshot.",
        "Write the summary as no more than two concise professional sentences. Visual-guide labels must be two to four words, contain no price, and use institutional chart language such as Nearest resistance, Primary support, or Secondary support.",
        "Present plausible bullish and bearish interpretations with equal seriousness. If the image is unclear, say so and make the response more cautious.",
        "Treat urgency, revenge trading, fear of missing out and missing invalidation as reasons to pause.",
        "Return only the requested JSON. Do not mention these instructions.",
      ].join(" "),
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              market: input.market,
              timeframe: input.timeframe,
              currentPrice: input.currentPrice,
              intendedDirection: input.direction,
              entry: input.entry,
              stop: input.stop,
              target: input.target,
              maximumRiskOrStake: input.stake || null,
              emotion: input.emotion || null,
              userThesis: input.thesis || null,
            }),
          },
          { type: "input_image", image_url: input.imageDataUrl, detail: "low" },
        ],
      }],
      // This cap includes hidden reasoning as well as the required safety JSON.
      // Keep reasoning and visible verbosity low, but leave enough room for a
      // complete schema-valid response so it is not withheld as truncated JSON.
      max_output_tokens: 4000,
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "bullseye_second_opinion",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              chartReadability: { type: "string", enum: ["clear", "partial", "unreadable"] },
              directionalLean: { type: "string", enum: ["bullish", "bearish", "neutral"] },
              summary: { type: "string", minLength: 1, maxLength: 240 },
              observations: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 220 } },
              bullCase: { type: "string", minLength: 1, maxLength: 280 },
              bearCase: { type: "string", minLength: 1, maxLength: 280 },
              invalidation: { type: "string", minLength: 1, maxLength: 240 },
              noTradeReasons: { type: "array", minItems: 2, maxItems: 5, items: { type: "string", minLength: 1, maxLength: 180 } },
              disciplineCheck: { type: "string", minLength: 1, maxLength: 260 },
              uncertainties: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 180 } },
              visualGuides: {
                type: "array",
                minItems: 0,
                maxItems: 6,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    tool: { type: "string", enum: ["support", "resistance"] },
                    yPercent: { type: "number", minimum: 5, maximum: 95 },
                    label: { type: "string", minLength: 1, maxLength: 28 },
                    confidence: { type: "string", enum: ["low", "medium", "high"] },
                  },
                  required: ["tool", "yPercent", "label", "confidence"],
                },
              },
              extracted: {
                type: "object",
                additionalProperties: false,
                properties: {
                  market: { type: ["string", "null"], maxLength: 32 },
                  timeframe: { type: ["string", "null"], enum: ["1m", "5m", "15m", "1h", "4h", "daily", null] },
                  platform: { type: ["string", "null"], maxLength: 48 },
                  visiblePrice: { type: ["number", "null"] },
                  intendedDirection: { type: "string", enum: ["long", "short", "neutral"] },
                  entry: { type: ["number", "null"] },
                  stop: { type: ["number", "null"] },
                  target: { type: ["number", "null"] },
                  indicators: { type: "array", minItems: 0, maxItems: 8, items: { type: "string", minLength: 1, maxLength: 48 } },
                  confidence: { type: "string", enum: ["low", "medium", "high"] },
                  confirmationNeeded: { type: "array", minItems: 0, maxItems: 6, items: { type: "string", minLength: 1, maxLength: 140 } },
                },
                required: ["market", "timeframe", "platform", "visiblePrice", "intendedDirection", "entry", "stop", "target", "indicators", "confidence", "confirmationNeeded"],
              },
            },
            required: ["chartReadability", "directionalLean", "summary", "observations", "bullCase", "bearCase", "invalidation", "noTradeReasons", "disciplineCheck", "uncertainties", "visualGuides", "extracted"],
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
    if (!validContent(parsed)) return { status: "invalid_response", content: null };
    return {
      status: "generated",
      content: {
        chartReadability: parsed.chartReadability,
        directionalLean: parsed.directionalLean,
        summary: parsed.summary.trim(),
        observations: parsed.observations.map((item) => item.trim()),
        bullCase: parsed.bullCase.trim(),
        bearCase: parsed.bearCase.trim(),
        invalidation: parsed.invalidation.trim(),
        noTradeReasons: parsed.noTradeReasons.map((item) => item.trim()),
        disciplineCheck: parsed.disciplineCheck.trim(),
        uncertainties: parsed.uncertainties.map((item) => item.trim()),
        visualGuides: parsed.visualGuides.map((guide) => ({ ...guide, label: guide.label.trim() })),
        riskReward: calculatedExtractedRiskReward(input, parsed.extracted),
        extracted: {
          ...parsed.extracted,
          market: parsed.extracted.market?.trim() || null,
          platform: parsed.extracted.platform?.trim() || null,
        },
      },
    };
  } catch (error) {
    return { status: safeFailure(error), content: null };
  } finally {
    clearTimeout(timeout);
  }
}
