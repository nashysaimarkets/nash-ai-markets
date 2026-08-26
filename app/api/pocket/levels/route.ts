import { NextResponse } from "next/server";
import { createOpenAIClient, OPENAI_DEFAULT_MODEL } from "../../../lib/server/openai";
import { pocketBudgetHeaders, takePocketBudget } from "../../../lib/server/pocket-request-budget";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_DATA_URL_LENGTH = 11_000_000;

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    plotBounds: { type: "object", additionalProperties: false, properties: { left: { type: "number", minimum: 0, maximum: 100 }, top: { type: "number", minimum: 0, maximum: 100 }, right: { type: "number", minimum: 0, maximum: 100 }, bottom: { type: "number", minimum: 0, maximum: 100 } }, required: ["left", "top", "right", "bottom"] },
    priceScaleAnchors: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, properties: { price: { type: "number" }, y: { type: "number", minimum: 0, maximum: 100 } }, required: ["price", "y"] } },
    levels: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, properties: { kind: { type: "string", enum: ["support", "resistance", "pivot", "zone"] }, label: { type: "string", maxLength: 50 }, price: { type: "string", maxLength: 30 }, x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 }, x2: { type: "number", minimum: 0, maximum: 100 }, y2: { type: "number", minimum: 0, maximum: 100 } }, required: ["kind", "label", "price", "x", "y", "x2", "y2"] } },
    currentPrice: { type: "string", maxLength: 30 },
    levelStory: { type: "string", maxLength: 260 },
    confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    limitation: { type: "string", maxLength: 160 },
  },
  required: ["plotBounds", "priceScaleAnchors", "levels", "currentPrice", "levelStory", "confidence", "limitation"],
} as const;

export async function POST(request: Request) {
  let image = "";
  let precisionImage = "";
  try {
    const payload = await request.json() as { image?: unknown; precisionImage?: unknown };
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
        "Use only visible candle reactions. Return full-image percentage coordinates. plotBounds encloses the candle plot only.",
        "Read 3-4 clearly printed price-axis labels where possible. Exact numeric prices require at least two widely separated readable scale labels that form a consistent linear scale.",
        "When the scale is unreadable but candle reactions are visible, still return the strongest visual support and resistance areas with an empty price string and LOW confidence. Label these VISUAL SUPPORT AREA or VISUAL RESISTANCE AREA.",
        "Support and resistance lines span plotBounds left to right. Prefer one strong level on each side of current price; never use phone chrome, order tickets, footer values or the current-price guide as a structural level.",
        "levelStory must briefly say what was verified and what still needs visual confirmation. Never invent hidden prices.",
      ].join(" "),
      input: [{ role: "user", content: [
        { type: "input_text", text: "Independently rescan this chart for the clearest support and resistance. Accuracy matters more than quantity." },
        { type: "input_image", image_url: image, detail: "high" },
        ...(precisionImage ? [{ type: "input_image" as const, image_url: precisionImage, detail: "high" as const }] : []),
      ] }],
      max_output_tokens: 1600,
      text: { format: { type: "json_schema", name: "pocket_bullseye_level_lab", strict: true, schema } },
    });
    const output = response.output_text?.trim();
    if (!output) throw new Error("The level scan returned no result.");
    return NextResponse.json({ levels: JSON.parse(output) }, { headers: pocketBudgetHeaders(budget) });
  } catch (error) {
    console.error("[pocket-bullseye] independent level scan failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "The independent level scan could not complete. Please retry with a clearer price scale." }, { status: 502, headers: pocketBudgetHeaders(budget) });
  }
}
