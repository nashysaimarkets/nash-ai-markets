import { NextResponse } from "next/server";
import { createOpenAIClient, OPENAI_DEFAULT_MODEL } from "../../../lib/server/openai";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../lib/server/bounded-json-body";
import { pocketBudgetHeaders, takePocketBudget } from "../../../lib/server/pocket-request-budget";
import { levelLabRejectionMessage, validateLevelLabPrimaryProvenance, validateLevelLabScan } from "../level-lab-validation.ts";
import { rejectCrossOrigin } from "../../../lib/server/same-origin";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_DATA_URL_LENGTH = 11_000_000;
const MAX_REQUEST_BYTES = MAX_DATA_URL_LENGTH * 2 + 8_192;

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    instrumentIdentifier: { type: "string", maxLength: 80 },
    instrumentConfidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] },
    candlesReadable: { type: "boolean" },
    priceScaleReadable: { type: "boolean" },
    plotBounds: { type: "object", additionalProperties: false, properties: { left: { type: "number", minimum: 0, maximum: 100 }, top: { type: "number", minimum: 0, maximum: 100 }, right: { type: "number", minimum: 0, maximum: 100 }, bottom: { type: "number", minimum: 0, maximum: 100 } }, required: ["left", "top", "right", "bottom"] },
    priceScaleAnchors: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, properties: { price: { type: "number" }, y: { type: "number", minimum: 0, maximum: 100 } }, required: ["price", "y"] } },
    levels: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, properties: { kind: { type: "string", enum: ["support", "resistance"] }, label: { type: "string", maxLength: 50 }, price: { type: "string", maxLength: 30 }, x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 }, x2: { type: "number", minimum: 0, maximum: 100 }, y2: { type: "number", minimum: 0, maximum: 100 } }, required: ["kind", "label", "price", "x", "y", "x2", "y2"] } },
    currentPrice: { type: "string", maxLength: 30 },
    levelStory: { type: "string", maxLength: 260 },
    confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    limitation: { type: "string", maxLength: 160 },
  },
  required: ["instrumentIdentifier", "instrumentConfidence", "candlesReadable", "priceScaleReadable", "plotBounds", "priceScaleAnchors", "levels", "currentPrice", "levelStory", "confidence", "limitation"],
} as const;

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  let image = "";
  let precisionImage = "";
  let primaryProvenance: ReturnType<typeof validateLevelLabPrimaryProvenance> = null;
  try {
    const payload = await readBoundedJsonBody(request, MAX_REQUEST_BYTES) as { image?: unknown; precisionImage?: unknown; primaryProvenance?: unknown };
    image = typeof payload.image === "string" ? payload.image : "";
    precisionImage = typeof payload.precisionImage === "string" ? payload.precisionImage : "";
    primaryProvenance = validateLevelLabPrimaryProvenance(payload.primaryProvenance);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "The Level Lab request is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid chart upload." }, { status: 400 });
  }
  const valid = (value: string) => /^data:image\/(jpeg|png|webp);base64,/.test(value) && value.length <= MAX_DATA_URL_LENGTH;
  if (!valid(image) || (precisionImage && !valid(precisionImage))) return NextResponse.json({ error: "Please add a valid JPEG, PNG or WebP chart under 8 MB." }, { status: 400 });
  if (!primaryProvenance) return NextResponse.json({ error: levelLabRejectionMessage("PRIMARY_PROVENANCE_UNVERIFIED") }, { status: 409 });
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
        "Read instrumentIdentifier exactly as visibly printed on this Level Lab chart. Use UNKNOWN with instrumentConfidence UNKNOWN when hidden. Never copy the expected identity from the prompt unless it is independently visible in the screenshot.",
        "candlesReadable is true only when the reaction candle bodies and wicks are discernible. priceScaleReadable is true only when multiple consistent axis labels are clearly legible.",
        "Use only visible candle reactions. Return full-image percentage coordinates. plotBounds encloses the candle plot only.",
        "Read 3-4 clearly printed price-axis labels where possible. Exact numeric prices require at least two widely separated readable scale labels that form a consistent linear scale.",
        "Support and resistance lines span plotBounds left to right. Prefer one strong level on each side of current price; never use phone chrome, order tickets, footer values or the current-price guide as a structural level.",
        "Return currentPrice only from the exact visibly printed live/last-price marker. It is a compatibility check and never authorises replacing the verified primary price.",
        "levelStory must briefly say what was verified and what still needs visual confirmation. Never invent hidden prices.",
      ].join(" "),
      input: [{ role: "user", content: [
        { type: "input_text", text: `Independently rescan this chart for the clearest support and resistance. It may be applied only to the verified primary provenance instrument=${primaryProvenance.instrument}; ticker=${primaryProvenance.ticker || "not supplied"}; timeframe=${primaryProvenance.timeframe}; current-price reference=${primaryProvenance.currentPrice}. Verify the uploaded chart independently. Accuracy matters more than quantity.` },
        { type: "input_image", image_url: image, detail: "high" },
        ...(precisionImage ? [{ type: "input_image" as const, image_url: precisionImage, detail: "high" as const }] : []),
      ] }],
      max_output_tokens: 1600,
      text: { format: { type: "json_schema", name: "pocket_bullseye_level_lab", strict: true, schema } },
    });
    const output = response.output_text?.trim();
    if (!output) throw new Error("The level scan returned no result.");
    const validation = validateLevelLabScan(JSON.parse(output), primaryProvenance);
    if (!validation.ok) {
      console.info("[pocket-bullseye] level lab held", JSON.stringify({ reason: validation.reason }));
      return NextResponse.json({ error: levelLabRejectionMessage(validation.reason) }, { status: 422, headers: pocketBudgetHeaders(budget) });
    }
    return NextResponse.json({ levels: validation.levels }, { headers: pocketBudgetHeaders(budget) });
  } catch (error) {
    console.error("[pocket-bullseye] independent level scan failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "The independent level scan could not complete. Please retry with a clearer price scale." }, { status: 502, headers: pocketBudgetHeaders(budget) });
  }
}
