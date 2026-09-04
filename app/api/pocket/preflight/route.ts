import { NextResponse } from "next/server";
import { classifyOpenAIUnavailableReason, createOpenAIClient } from "../../../lib/server/openai";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../lib/server/bounded-json-body";
import { pocketBudgetHeaders, takePocketBudget } from "../../../lib/server/pocket-request-budget";
import {
  getPocketCachedResponse,
  pocketAIEnabled,
  pocketAIUsageRecord,
  pocketRequestId,
  pocketRequestIdentity,
  pocketResponseCacheKey,
  recordPocketAIUsage,
  savePocketCachedResponse,
  type PocketAIUsageRecord,
} from "../../../lib/server/pocket-ai-commercial-guard";
import { rejectCrossOrigin } from "../../../lib/server/same-origin";

export const runtime = "nodejs";
export const maxDuration = 30;
const MAX_DATA_URL_LENGTH = 11_000_000;
const MAX_REQUEST_BYTES = MAX_DATA_URL_LENGTH * 2 + 4_096;
const POCKET_PREFLIGHT_MODEL = "gpt-5.6-luna";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["READY", "LIMITED", "RETAKE"] },
    instrument: { type: "string", maxLength: 80 },
    instrumentConfidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] },
    timeframe: { type: "string", maxLength: 30 },
    timeframeConfidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] },
    currentPrice: { type: "string", maxLength: 30 },
    currentPriceConfidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] },
    priceScaleVisible: { type: "boolean" },
    candlesReadable: { type: "boolean" },
    enoughHistory: { type: "boolean" },
    sameInstrument: { type: ["boolean", "null"] },
    issues: { type: "array", maxItems: 4, items: { type: "string", maxLength: 100 } },
    guidance: { type: "string", maxLength: 180 },
  },
  required: ["status", "instrument", "instrumentConfidence", "timeframe", "timeframeConfidence", "currentPrice", "currentPriceConfidence", "priceScaleVisible", "candlesReadable", "enoughHistory", "sameInstrument", "issues", "guidance"],
} as const;

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  if (!pocketAIEnabled()) return NextResponse.json({
    code: "AI_DISABLED",
    error: "Analysis is paused by the service owner. No request was sent to the AI provider.",
  }, { status: 503, headers: { "cache-control": "no-store" } });
  const identityHash = pocketRequestIdentity(request);
  const requestId = pocketRequestId();
  const usageRecords: PocketAIUsageRecord[] = [];
  let image = "";
  let contextImage = "";
  try {
    const payload = await readBoundedJsonBody(request, MAX_REQUEST_BYTES) as { image?: unknown; contextImage?: unknown };
    image = typeof payload.image === "string" ? payload.image : "";
    contextImage = typeof payload.contextImage === "string" ? payload.contextImage : "";
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "The preflight request is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid chart upload." }, { status: 400 });
  }
  const valid = (value: string) => /^data:image\/(jpeg|png|webp);base64,/.test(value) && value.length <= MAX_DATA_URL_LENGTH;
  if (!valid(image) || (contextImage && !valid(contextImage))) return NextResponse.json({ error: "Please use valid chart images under 8 MB." }, { status: 400 });

  const model = process.env.OPENAI_POCKET_SUPPORT_MODEL?.trim() || POCKET_PREFLIGHT_MODEL;
  const cacheKey = pocketResponseCacheKey("preflight", [model, image, contextImage]);
  const cached = await getPocketCachedResponse(cacheKey, "preflight");
  if (cached?.preflight) {
    await recordPocketAIUsage(identityHash, requestId, true, [], "cache_hit");
    return NextResponse.json(cached, { headers: { "cache-control": "no-store", "x-pocket-ai-cache": "HIT" } });
  }

  const budget = takePocketBudget(request, "preflight");
  if (!budget.allowed) return NextResponse.json({ error: "Preflight needs a short reset. You may continue to analysis." }, { status: 429, headers: pocketBudgetHeaders(budget) });
  const client = createOpenAIClient(undefined, 25_000);
  if (!client) return NextResponse.json({ error: "Preflight is temporarily unavailable." }, { status: 503, headers: pocketBudgetHeaders(budget) });

  try {
    const response = await client.responses.create({
      model,
      reasoning: { effort: "low" },
      store: false,
      instructions: [
        "Perform a fast screenshot quality preflight only; do not analyse market direction and do not return trading advice.",
        "Read the instrument and timeframe only when visibly printed. Otherwise return UNKNOWN with the correct confidence.",
        "priceScaleVisible is true only when at least two right-side or left-side axis prices are legible.",
        "currentPrice is the exact visibly printed live/last-price marker nearest the latest candle. If it is absent or ambiguous return UNKNOWN and currentPriceConfidence UNKNOWN.",
        "candlesReadable requires discernible candle bodies and wicks. enoughHistory requires enough visible candles to judge repeated reactions or a meaningful swing.",
        "When a second image is supplied, sameInstrument is true only when both visible labels clearly match, false when they clearly conflict, otherwise null.",
        "Use RETAKE only when unreadable candles, missing price scale, severe cropping, or a confirmed instrument mismatch would make full analysis wasteful.",
        "Use LIMITED when analysis remains useful but a label, history, or second-chart match is uncertain. Use READY when the required evidence is clear.",
        "Give one short, precise retake instruction. Never invent a label hidden by cropping.",
      ].join(" "),
      input: [{ role: "user", content: [
        { type: "input_text", text: `Check the primary chart${contextImage ? " and optional context chart" : ""} before full Pocket Bullseye analysis.` },
        { type: "input_image", image_url: image, detail: "low" },
        ...(contextImage ? [{ type: "input_image" as const, image_url: contextImage, detail: "low" as const }] : []),
      ] }],
      max_output_tokens: 800,
      text: { format: { type: "json_schema", name: "pocket_chart_preflight", strict: true, schema } },
    });
    const usage = pocketAIUsageRecord("preflight", model, response);
    if (usage) {
      usageRecords.push(usage);
      console.info("[pocket-ai-usage]", JSON.stringify(usage));
    }
    const output = response.output_text?.trim();
    if (!output) throw new Error("empty preflight");
    const result = { preflight: JSON.parse(output) } as Record<string, unknown>;
    await Promise.all([
      savePocketCachedResponse(cacheKey, "preflight", result),
      recordPocketAIUsage(identityHash, requestId, false, usageRecords, "success"),
    ]);
    return NextResponse.json(result, { headers: { ...pocketBudgetHeaders(budget), "x-pocket-ai-cache": "MISS" } });
  } catch (error) {
    const reason = classifyOpenAIUnavailableReason(error);
    console.error("[pocket-preflight] unavailable", JSON.stringify({ reason }));
    await recordPocketAIUsage(identityHash, requestId, false, usageRecords, "failed");
    if (reason === "quota_exhausted") {
      return NextResponse.json({
        code: "AI_CREDITS_UNAVAILABLE",
        error: "Analysis service is temporarily unavailable. Your chart has not been rejected.",
      }, { status: 503, headers: pocketBudgetHeaders(budget) });
    }
    return NextResponse.json({ error: "Preflight could not complete. You may continue to analysis." }, { status: 503, headers: pocketBudgetHeaders(budget) });
  }
}
