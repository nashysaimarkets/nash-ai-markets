import { NextResponse } from "next/server";
import { classifyOpenAIFailure, createOpenAIClient, OPENAI_DEFAULT_MODEL } from "../../../lib/server/openai";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../lib/server/bounded-json-body";
import { pocketBudgetHeaders, takePocketBudget } from "../../../lib/server/pocket-request-budget";
import { rejectCrossOrigin } from "../../../lib/server/same-origin";

export const runtime = "nodejs";
export const maxDuration = 30;
const MAX_DATA_URL_LENGTH = 11_000_000;
const MAX_REQUEST_BYTES = MAX_DATA_URL_LENGTH * 4 + 8_192;

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
    timeframeChecks: {
      type: "array", minItems: 4, maxItems: 4, items: {
        type: "object", additionalProperties: false,
        properties: {
          slot: { type: "string", enum: ["5M", "30M", "1H", "4H"] },
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
  required: ["status", "instrument", "instrumentConfidence", "timeframe", "timeframeConfidence", "currentPrice", "currentPriceConfidence", "priceScaleVisible", "candlesReadable", "enoughHistory", "sameInstrument", "timeframeChecks", "issues", "guidance"],
} as const;

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  let image = "";
  let contextImage = "";
  let detailImage = "";
  let fourHourImage = "";
  try {
    const payload = await readBoundedJsonBody(request, MAX_REQUEST_BYTES) as { image?: unknown; contextImage?: unknown; detailImage?: unknown; fourHourImage?: unknown };
    image = typeof payload.image === "string" ? payload.image : "";
    contextImage = typeof payload.contextImage === "string" ? payload.contextImage : "";
    detailImage = typeof payload.detailImage === "string" ? payload.detailImage : "";
    fourHourImage = typeof payload.fourHourImage === "string" ? payload.fourHourImage : "";
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "The preflight request is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid chart upload." }, { status: 400 });
  }
  const valid = (value: string) => /^data:image\/(jpeg|png|webp);base64,/.test(value) && value.length <= MAX_DATA_URL_LENGTH;
  if (![image, contextImage, detailImage, fourHourImage].every(valid)) return NextResponse.json({ error: "Please add valid 5m, 30m, 1h and 4h chart images under 8 MB." }, { status: 400 });

  const budget = takePocketBudget(request, "preflight");
  if (!budget.allowed) return NextResponse.json({ error: "Preflight needs a short reset. You may continue to analysis." }, { status: 429, headers: pocketBudgetHeaders(budget) });
  const client = createOpenAIClient(undefined, 25_000);
  if (!client) return NextResponse.json({ error: "Preflight is temporarily unavailable." }, { status: 503, headers: pocketBudgetHeaders(budget) });

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_POCKET_ANNOTATION_MODEL?.trim() || process.env.OPENAI_POCKET_MODEL?.trim() || OPENAI_DEFAULT_MODEL,
      reasoning: { effort: "low" },
      store: false,
      instructions: [
        "Perform a fast screenshot quality preflight only; do not analyse market direction and do not return trading advice.",
        "Read the top-level instrument, timeframe and currentPrice from image 1 only. The top-level timeframe must be the exact visibly printed image-1 label (for example 5m), never a list, requested sequence, expected slot, or inferred value. Otherwise return UNKNOWN with the correct confidence.",
        "priceScaleVisible is true only when at least two right-side or left-side axis prices are legible.",
        "currentPrice is the exact visibly printed live/last-price marker nearest the latest candle. If it is absent or ambiguous return UNKNOWN and currentPriceConfidence UNKNOWN.",
        "candlesReadable requires discernible candle bodies and wicks. enoughHistory requires enough visible candles to judge repeated reactions or a meaningful swing.",
        "The four images are supplied in a fixed order: image 1 must be 5m, image 2 must be 30m, image 3 must be 1h, and image 4 must be 4h.",
        "Return exactly four timeframeChecks in that order. Each detected value must be the exact label visibly printed on that image, never the expected slot. matchesExpected is true only when that visible label matches the slot, false only when it visibly conflicts, and null when unreadable.",
        "sameInstrument is true only when every readable instrument label matches image 1, false when any clearly conflicts, otherwise null.",
        "Use RETAKE when candles are unreadable, the price scale is missing, cropping is severe, an instrument mismatch is confirmed, or any timeframe is visibly in the wrong slot.",
        "Use LIMITED when analysis remains useful but a label, history, or second-chart match is uncertain. Use READY when the required evidence is clear.",
        "Give one short, precise retake instruction. Never invent a label hidden by cropping.",
      ].join(" "),
      input: [{ role: "user", content: [
        { type: "input_text", text: "Check this required four-timeframe Pocket Bullseye pack. IMAGE 1: 5 MINUTES." },
        { type: "input_image", image_url: image, detail: "low" },
        { type: "input_text", text: "IMAGE 2: 30 MINUTES." },
        { type: "input_image", image_url: contextImage, detail: "low" },
        { type: "input_text", text: "IMAGE 3: 1 HOUR." },
        { type: "input_image", image_url: detailImage, detail: "low" },
        { type: "input_text", text: "IMAGE 4: 4 HOURS." },
        { type: "input_image", image_url: fourHourImage, detail: "low" },
      ] }],
      max_output_tokens: 1200,
      text: { format: { type: "json_schema", name: "pocket_chart_preflight", strict: true, schema } },
    });
    const output = response.output_text?.trim();
    if (!output) throw new Error("empty preflight");
    return NextResponse.json({ preflight: JSON.parse(output) }, { headers: pocketBudgetHeaders(budget) });
  } catch (error) {
    const reason = classifyOpenAIFailure(error);
    console.warn("[pocket-preflight] unavailable", JSON.stringify({ reason }));
    const message = reason === "quota_exhausted"
      ? "AI checks are temporarily unavailable because service capacity has been reached. Your chart is saved, but full analysis cannot run until service is restored."
      : "Preflight could not complete. You may continue to analysis.";
    return NextResponse.json({ error: message }, { status: 503, headers: pocketBudgetHeaders(budget) });
  }
}
