import { pocketImageContent, validatePocketImages } from "../../../pocket/chart-images";
import { NextResponse } from "next/server";
import { classifyOpenAIFailure, createOpenAIClient, OPENAI_DEFAULT_MODEL } from "../../../lib/server/openai";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../lib/server/bounded-json-body";
import { pocketBudgetHeaders, takePocketBudget } from "../../../lib/server/pocket-request-budget";
import { rejectCrossOrigin } from "../../../lib/server/same-origin";

export const runtime = "nodejs";
export const maxDuration = 30;
const MAX_DATA_URL_LENGTH = 11_000_000;
const MAX_REQUEST_BYTES = MAX_DATA_URL_LENGTH * 5 + 8_192;

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
    captureAlignment: { type: "string", enum: ["ALIGNED", "MIXED", "UNKNOWN"] },
    timeframeChecks: {
      type: "array", minItems: 1, maxItems: 5, items: {
        type: "object", additionalProperties: false,
        properties: {
          slot: { type: "string", enum: ["PRIMARY", "HIGHER_TIMEFRAME", "PRICE_DETAIL", "FOUR_HOUR", "INDICATOR_VOLUME"] },
          detected: { type: "string", maxLength: 30 },
          confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] },
          matchesExpected: { type: ["boolean", "null"] },
        },
        required: ["slot", "detected", "confidence", "matchesExpected"],
      },
    },
    issues: { type: "array", maxItems: 4, items: { type: "string", maxLength: 100 } },
    guidance: { type: "string", maxLength: 180 },
  },
  required: ["status", "instrument", "instrumentConfidence", "timeframe", "timeframeConfidence", "currentPrice", "currentPriceConfidence", "priceScaleVisible", "candlesReadable", "enoughHistory", "sameInstrument", "captureAlignment", "timeframeChecks", "issues", "guidance"],
} as const;

export async function POST(request: Request) {
  const startedAt = Date.now();
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  let image = "";
  let contextImage = "";
  let detailImage = "";
  let fourHourImage = "";
  let indicatorImage = "";
  try {
    const payload = await readBoundedJsonBody(request, MAX_REQUEST_BYTES) as { image?: unknown; contextImage?: unknown; detailImage?: unknown; fourHourImage?: unknown; indicatorImage?: unknown };
    const imageError = validatePocketImages(payload);
    if (imageError) return NextResponse.json({ error: imageError }, { status: 400 });
    image = typeof payload.image === "string" ? payload.image : "";
    contextImage = typeof payload.contextImage === "string" ? payload.contextImage : "";
    detailImage = typeof payload.detailImage === "string" ? payload.detailImage : "";
    fourHourImage = typeof payload.fourHourImage === "string" ? payload.fourHourImage : "";
    indicatorImage = typeof payload.indicatorImage === "string" ? payload.indicatorImage : "";
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "The preflight request is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid chart upload." }, { status: 400 });
  }

  const budget = takePocketBudget(request, "preflight");
  if (!budget.allowed) return NextResponse.json({ error: "Preflight needs a short reset. You may continue to analysis." }, { status: 429, headers: pocketBudgetHeaders(budget) });
  const client = createOpenAIClient(undefined, 25_000);
  if (!client) return NextResponse.json({ error: "Preflight is temporarily unavailable." }, { status: 503, headers: pocketBudgetHeaders(budget) });

  // The SDK transport timeout ends when response headers arrive. Bound the
  // whole body as well and cancel superseded uploads at the provider.
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new Error("Preflight timed out.")), 25_000);
  const signal = AbortSignal.any([request.signal, deadline.signal]);
  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_POCKET_ANNOTATION_MODEL?.trim() || process.env.OPENAI_POCKET_MODEL?.trim() || OPENAI_DEFAULT_MODEL,
      service_tier: "priority",
      reasoning: { effort: "low" },
      store: false,
      instructions: [
        "Perform a fast screenshot quality preflight only; do not analyse market direction and do not return trading advice.",
        "Read the top-level instrument, timeframe and currentPrice from image 1 only. The top-level timeframe must be the exact visibly printed image-1 label (for example 5m), never a list, requested sequence, expected slot, or inferred value. Otherwise return UNKNOWN with the correct confidence.",
        "Copy the instrument title exactly as printed, including broker qualifiers. Do not add a currency, ticker, or market name that is not visible.",
        "priceScaleVisible is true only when at least two right-side or left-side axis prices are legible.",
        "currentPrice is the exact visibly printed live/last-price marker nearest the latest candle. If it is absent or ambiguous return UNKNOWN and currentPriceConfidence UNKNOWN.",
        "candlesReadable requires discernible candle bodies and wicks. enoughHistory requires enough visible candles to judge repeated reactions or a meaningful swing.",
        "One primary chart is required; up to four supporting charts are optional. Any visible timeframe is valid. Internal role names are source identifiers, not expected timeframe labels.",
        "Return exactly one timeframeChecks item per supplied chart, using its labelled ROLE as slot. detected is the exact visibly printed timeframe, never inferred from the role. matchesExpected is true for a readable timeframe and null when unreadable; no particular timeframe is required.",
        "captureAlignment concerns screenshot capture timestamps only. ALIGNED requires explicit comparable capture timestamps on all supplied screenshots; MIXED requires explicit timestamps showing materially different capture moments. Otherwise UNKNOWN. Different candle timeframes, historical axis dates and last completed candle times are not evidence of different capture moments. Warn in issues when MIXED; never invent a timestamp or reject solely because timing is UNKNOWN.",
        "With only one chart sameInstrument is null. With supporting charts it is true only when their readable instrument labels match the primary chart, false when any clearly conflicts, otherwise null.",
        "Use RETAKE when candles are unreadable, cropping prevents a useful chart read, or an instrument mismatch is confirmed. A missing price scale allows LIMITED relative-structure analysis with numeric prices withheld. Never request a retake merely because optional charts are absent or a timeframe differs from a role name.",
        "Use LIMITED when analysis remains useful but a supplied label, history, scale, or supporting-chart match is uncertain. Use READY when the primary chart is clear; one chart alone is sufficient.",
        "Give one complete retake instruction under 140 characters. Never end mid-sentence and never invent a label hidden by cropping.",
      ].join(" "),
      input: [{ role: "user", content: pocketImageContent({ image, contextImage, detailImage, fourHourImage, indicatorImage }, "low") }],
      max_output_tokens: 2400,
      text: { format: { type: "json_schema", name: "pocket_chart_preflight", strict: true, schema } },
    }, { signal, timeout: 25_000 });
    signal.throwIfAborted();
    const output = response.output_text?.trim();
    if (response.status !== "completed" || !output) throw new Error("incomplete preflight");
    const preflight = JSON.parse(output);
    if (preflight.sameInstrument === false) preflight.status = "RETAKE";
    console.info("[pocket-preflight] completed", JSON.stringify({ elapsedMs: Date.now() - startedAt, status: preflight.status }));
    return NextResponse.json({ preflight }, { headers: pocketBudgetHeaders(budget) });
  } catch (error) {
    const reason = classifyOpenAIFailure(error);
    budget.release?.();
    console.warn("[pocket-preflight] unavailable", JSON.stringify({ reason, elapsedMs: Date.now() - startedAt, cancelled: request.signal.aborted, deadline: deadline.signal.aborted }));
    const message = reason === "quota_exhausted"
      ? "AI checks are temporarily unavailable because service capacity has been reached. Your chart is saved, but full analysis cannot run until service is restored."
      : "Preflight could not complete. You may continue to analysis.";
    return NextResponse.json({ error: message }, { status: 503, headers: pocketBudgetHeaders(budget) });
  } finally { clearTimeout(timer); deadline.abort(); }
}
