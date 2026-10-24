import { completedLevelLabResponse } from "../../../pocket/scanner-claims";
import { requirePocketScanAccess } from "../../../lib/server/pocket-scan-access";
import { NextResponse } from "next/server";
import { createOpenAIClient, OPENAI_DEFAULT_MODEL } from "../../../lib/server/openai";
import { pocketBudgetHeaders, takePocketBudget } from "../../../lib/server/pocket-request-budget";
import {validateLevelLabConfirmation} from "../../../pocket/level-lab-source";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_DATA_URL_LENGTH = 11_000_000;

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    instrument: {type:"string",maxLength:40},
    timeframe: {type:"string",maxLength:30},
    evidenceQuality: {type:"object",additionalProperties:false,properties:{
      chartReadability:{type:"string",enum:["CLEAR","PARTIAL","POOR"]},
      instrumentConfidence:{type:"string",enum:["HIGH","MEDIUM","LOW","UNKNOWN"]},
      timeframeConfidence:{type:"string",enum:["HIGH","MEDIUM","LOW","UNKNOWN"]},
      scaleReadable:{type:"boolean"},candlesReadable:{type:"boolean"},
      limitations:{type:"array",maxItems:2,items:{type:"string",maxLength:160}},
    },required:["chartReadability","instrumentConfidence","timeframeConfidence","scaleReadable","candlesReadable","limitations"]},
    plotBounds: { type: "object", additionalProperties: false, properties: { left: { type: "number", minimum: 0, maximum: 100 }, top: { type: "number", minimum: 0, maximum: 100 }, right: { type: "number", minimum: 0, maximum: 100 }, bottom: { type: "number", minimum: 0, maximum: 100 } }, required: ["left", "top", "right", "bottom"] },
    priceScaleAnchors: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, properties: { price: { type: "number" }, y: { type: "number", minimum: 0, maximum: 100 } }, required: ["price", "y"] } },
    levels: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, properties: { kind: { type: "string", enum: ["support", "resistance", "pivot", "zone"] }, label: { type: "string", maxLength: 50 }, price: { type: "string", maxLength: 30 }, x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 }, x2: { type: "number", minimum: 0, maximum: 100 }, y2: { type: "number", minimum: 0, maximum: 100 } }, required: ["kind", "label", "price", "x", "y", "x2", "y2"] } },
    currentPrice: { type: "string", maxLength: 30 },
    levelStory: { type: "string", maxLength: 260 },
    confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    limitation: { type: "string", maxLength: 160 },
  },
  required: ["instrument", "timeframe", "evidenceQuality", "plotBounds", "priceScaleAnchors", "levels", "currentPrice", "levelStory", "confidence", "limitation"],
} as const;

export async function POST(request: Request) {
  const accessError = await requirePocketScanAccess(request);
  if (accessError) return accessError;
  let image = "";
  let precisionImage = "";
  let chartConfirmation:ReturnType<typeof validateLevelLabConfirmation>=null;
  try {
    const payload = await request.json() as { image?: unknown; precisionImage?: unknown; chartConfirmation?:unknown };
    if(payload.chartConfirmation!=null){chartConfirmation=validateLevelLabConfirmation(payload.chartConfirmation);if(!chartConfirmation)return NextResponse.json({error:"Confirm valid source chart facts for Level Lab."},{status:400});}
    image = typeof payload.image === "string" ? payload.image : "";
    precisionImage = typeof payload.precisionImage === "string" ? payload.precisionImage : "";
  } catch { return NextResponse.json({ error: "Invalid chart upload." }, { status: 400 }); }
  const valid = (value: string) => /^data:image\/(jpeg|png|webp);base64,/.test(value) && value.length <= MAX_DATA_URL_LENGTH;
  if (!valid(image) || (precisionImage && !valid(precisionImage))) return NextResponse.json({ error: "Please add a valid JPEG, PNG or WebP chart under 8 MB." }, { status: 400 });
  const budget = takePocketBudget(request, "levels");
  if (!budget.allowed) return NextResponse.json({ error: "The level scanner needs a short reset." }, { status: 429, headers: pocketBudgetHeaders(budget) });
  const client = createOpenAIClient(undefined, 55_000);
  if (!client) return NextResponse.json({ error: "AI level scanning is not connected in this environment." }, { status: 503 });
  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_POCKET_ANNOTATION_MODEL?.trim() || process.env.OPENAI_POCKET_MODEL?.trim() || OPENAI_DEFAULT_MODEL,
      reasoning: { effort: "low" }, store: false,
      instructions: [
        "You are Pocket Bullseye Level Lab. Analyse support and resistance only. Do not produce or change a verdict, pattern, scenario, score, direction, plan or risk assessment.",
        "Read instrument, timeframe, current price and evidenceQuality independently from this source image. Unreadable or conflicting labels retain LOW or UNKNOWN confidence. Trader-confirmed facts are context only; never manufacture HIGH identity confidence or alter visible prices to match them.",
        "Use only visible candle reactions. Return full-image percentage coordinates. plotBounds encloses the candle plot only.",
        "Read 3-4 clearly printed price-axis labels where possible. Exact numeric prices require at least two widely separated readable scale labels that form a consistent linear scale.",
        "When the scale is unreadable but candle reactions are visible, still return the strongest visual support and resistance areas with an empty price string and LOW confidence. Label these VISUAL SUPPORT AREA or VISUAL RESISTANCE AREA.",
        "Support and resistance lines span plotBounds left to right. Prefer one strong level on each side of current price; never use phone chrome, order tickets, footer values or the current-price guide as a structural level.",
        "levelStory must briefly say what was verified and what still needs visual confirmation. Never invent hidden prices.",
      ].join(" "),
      input: [{ role: "user", content: [
        { type: "input_text", text: "Independently rescan this chart for the clearest support and resistance. Accuracy matters more than quantity."+(chartConfirmation?` Source chart facts confirmed by the trader: ${JSON.stringify(chartConfirmation)}. Report any disagreement; do not override the source pixels.`:"") },
        { type: "input_image", image_url: image, detail: "high" },
        ...(precisionImage ? [{ type: "input_image" as const, image_url: precisionImage, detail: "high" as const }] : []),
      ] }],
      max_output_tokens: 1600,
      text: { format: { type: "json_schema", name: "pocket_bullseye_level_lab", strict: true, schema } },
    }, { signal: request.signal });
    const levels = completedLevelLabResponse(response);
    return NextResponse.json({ levels }, { headers: pocketBudgetHeaders(budget) });
  } catch (error) {
    console.error("[pocket-bullseye] independent level scan failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "The independent level scan could not complete. Please retry with a clearer price scale." }, { status: 502, headers: pocketBudgetHeaders(budget) });
  }
}
