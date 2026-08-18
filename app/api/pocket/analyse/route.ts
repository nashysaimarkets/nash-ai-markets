import { NextResponse } from "next/server";
import { createOpenAIClient, OPENAI_DEFAULT_MODEL } from "../../../lib/server/openai";

export const runtime = "nodejs";
const MAX_DATA_URL_LENGTH = 11_000_000;
const POCKET_ANALYSIS_TIMEOUT_MS = 30_000;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    direction: { type: "string", enum: ["BULLISH", "BEARISH", "NEUTRAL"] },
    confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    instrument: { type: "string" },
    timeframe: { type: "string" },
    summary: { type: "string" },
    bullishCase: { type: "string" },
    bearishCase: { type: "string" },
    invalidation: { type: "string" },
    riskFlags: { type: "array", maxItems: 5, items: { type: "string" } },
    indicators: { type: "array", maxItems: 6, items: { type: "string" } },
    levels: {
      type: "array", maxItems: 5, items: {
        type: "object", additionalProperties: false,
        properties: {
          kind: { type: "string", enum: ["support", "resistance", "trend"] },
          label: { type: "string" },
          price: { type: "string" },
          y: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["kind", "label", "price", "y"],
      },
    },
  },
  required: ["direction", "confidence", "instrument", "timeframe", "summary", "bullishCase", "bearishCase", "invalidation", "riskFlags", "indicators", "levels"],
} as const;

export async function POST(request: Request) {
  let image = "";
  try {
    const payload = await request.json() as { image?: unknown };
    image = typeof payload.image === "string" ? payload.image : "";
  } catch {
    return NextResponse.json({ error: "Invalid chart upload." }, { status: 400 });
  }
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > MAX_DATA_URL_LENGTH) {
    return NextResponse.json({ error: "Please upload a valid JPEG, PNG or WebP chart under 8 MB." }, { status: 400 });
  }
  const client = createOpenAIClient(undefined, POCKET_ANALYSIS_TIMEOUT_MS);
  if (!client) return NextResponse.json({ error: "AI analysis is not connected in this environment." }, { status: 503 });

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_POCKET_MODEL?.trim() || OPENAI_DEFAULT_MODEL,
      store: false,
      instructions: [
        "You are Pocket Bullseye, a cautious chart-reading assistant.",
        "Use only evidence visibly present in the uploaded chart. Never invent prices, indicator values, instrument names, timeframes, calendar events, news, entries, stops or targets.",
        "If text is unreadable, return UNKNOWN. Direction must be conditional and based on visible structure, never certainty.",
        "Give both bullish and bearish cases. Call out cropped scales, hidden axes, insufficient candles and ambiguous patterns.",
        "For each reliable support/resistance/trend level, return its vertical position y as a percentage from the top of the full image. Keep levels sparse and only include price text that is clearly legible.",
        "Indicators must describe only indicators visibly present, such as RSI or moving averages. Keep every field concise for a mobile display.",
      ].join(" "),
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Analyse this chart screenshot with balanced scenarios, visible levels, indicators and risks." },
          { type: "input_image", image_url: image, detail: "high" },
        ],
      }],
      max_output_tokens: 1200,
      text: { format: { type: "json_schema", name: "pocket_bullseye_chart_analysis", strict: true, schema } },
    });
    const analysis = JSON.parse(response.output_text);
    return NextResponse.json({ analysis }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const failure = error && typeof error === "object" ? error as {
      name?: unknown;
      message?: unknown;
      status?: unknown;
      code?: unknown;
      type?: unknown;
    } : {};
    console.error("[pocket-bullseye] analysis unavailable", JSON.stringify({
      name: typeof failure.name === "string" ? failure.name : "Error",
      status: typeof failure.status === "number" ? failure.status : null,
      code: typeof failure.code === "string" ? failure.code : null,
      type: typeof failure.type === "string" ? failure.type : null,
      message: typeof failure.message === "string" ? failure.message.slice(0, 240) : null,
    }));
    return NextResponse.json({ error: "Bullseye could not read that chart safely. Please try a clearer screenshot." }, { status: 503 });
  }
}
