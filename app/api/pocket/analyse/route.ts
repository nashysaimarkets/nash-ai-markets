import { NextResponse } from "next/server";
import { createOpenAIClient, OPENAI_DEFAULT_MODEL } from "../../../lib/server/openai";
import { getVerifiedMacroContext } from "../../../lib/verified-macro-context";

export const runtime = "nodejs";
const MAX_DATA_URL_LENGTH = 11_000_000;
const POCKET_ANALYSIS_TIMEOUT_MS = 55_000;
export const maxDuration = 60;
const INTENTIONS = ["LONG", "SHORT", "UNSURE"] as const;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    direction: { type: "string", enum: ["BULLISH", "BEARISH", "NEUTRAL"] },
    confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    instrument: { type: "string", maxLength: 40 },
    ticker: { type: "string", maxLength: 16 },
    timeframe: { type: "string", maxLength: 40 },
    summary: { type: "string", maxLength: 320 },
    verdict: { type: "string", enum: ["WATCH", "WAIT", "STAND_ASIDE", "REVIEW_REQUIRED"] },
    verdictHeadline: { type: "string", maxLength: 100 },
    setupScore: {
      type: "object", additionalProperties: false,
      properties: {
        overall: { type: "integer", minimum: 0, maximum: 100 },
        grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
        structure: { type: "integer", minimum: 0, maximum: 10 },
        momentum: { type: "integer", minimum: 0, maximum: 10 },
        location: { type: "integer", minimum: 0, maximum: 10 },
        confirmation: { type: "integer", minimum: 0, maximum: 10 },
        riskClarity: { type: "integer", minimum: 0, maximum: 10 },
        eventSafety: { type: "integer", minimum: 0, maximum: 10 },
      },
      required: ["overall", "grade", "structure", "momentum", "location", "confirmation", "riskClarity", "eventSafety"],
    },
    whatYouMayBeMissing: { type: "array", maxItems: 4, items: { type: "string", maxLength: 140 } },
    improvesSetup: { type: "array", maxItems: 4, items: { type: "string", maxLength: 140 } },
    killsSetup: { type: "array", maxItems: 4, items: { type: "string", maxLength: 140 } },
    traderTrap: { type: "string", maxLength: 180 },
    bullishCase: { type: "string", maxLength: 280 },
    bearishCase: { type: "string", maxLength: 280 },
    invalidation: { type: "string", maxLength: 280 },
    marketStructure: { type: "string", maxLength: 320 },
    levelStory: { type: "string", maxLength: 480 },
    momentum: { type: "string", maxLength: 240 },
    bullConfirmation: { type: "string", maxLength: 220 },
    bearConfirmation: { type: "string", maxLength: 220 },
    noTradeCondition: { type: "string", maxLength: 220 },
    riskFlags: { type: "array", maxItems: 4, items: { type: "string", maxLength: 140 } },
    indicators: { type: "array", maxItems: 5, items: { type: "string", maxLength: 120 } },
    checklist: { type: "array", maxItems: 5, items: { type: "string", maxLength: 120 } },
    relevantEventTypes: { type: "array", maxItems: 6, items: { type: "string", maxLength: 80 } },
    levels: {
      type: "array", maxItems: 5, items: {
        type: "object", additionalProperties: false,
        properties: {
          kind: { type: "string", enum: ["support", "resistance", "trend"] },
          label: { type: "string", maxLength: 50 },
          price: { type: "string", maxLength: 30 },
          y: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["kind", "label", "price", "y"],
      },
    },
    fibLevels: {
      type: "array", maxItems: 5, items: {
        type: "object", additionalProperties: false,
        properties: {
          ratio: { type: "string", maxLength: 12 },
          price: { type: "string", maxLength: 30 },
          y: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["ratio", "price", "y"],
      },
    },
  },
  required: ["direction", "confidence", "instrument", "ticker", "timeframe", "summary", "verdict", "verdictHeadline", "setupScore", "whatYouMayBeMissing", "improvesSetup", "killsSetup", "traderTrap", "bullishCase", "bearishCase", "invalidation", "marketStructure", "levelStory", "momentum", "bullConfirmation", "bearConfirmation", "noTradeCondition", "riskFlags", "indicators", "checklist", "relevantEventTypes", "levels", "fibLevels"],
} as const;

export async function POST(request: Request) {
  let image = "";
  let intention: typeof INTENTIONS[number] = "UNSURE";
  try {
    const payload = await request.json() as { image?: unknown; intention?: unknown };
    image = typeof payload.image === "string" ? payload.image : "";
    intention = typeof payload.intention === "string" && INTENTIONS.includes(payload.intention as typeof INTENTIONS[number])
      ? payload.intention as typeof INTENTIONS[number]
      : "UNSURE";
  } catch {
    return NextResponse.json({ error: "Invalid chart upload." }, { status: 400 });
  }
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > MAX_DATA_URL_LENGTH) {
    return NextResponse.json({ error: "Please upload a valid JPEG, PNG or WebP chart under 8 MB." }, { status: 400 });
  }
  const client = createOpenAIClient(undefined, POCKET_ANALYSIS_TIMEOUT_MS);
  if (!client) return NextResponse.json({ error: "AI analysis is not connected in this environment." }, { status: 503 });

  try {
    const macroContext = await getVerifiedMacroContext({ route: "/api/pocket/analyse" });
    const verifiedEvents = macroContext.releases.slice(0, 4).map((event) => `${event.name} (${event.agency}) at ${event.scheduledAt}, ${event.risk} impact`);
    const response = await client.responses.create({
      model: process.env.OPENAI_POCKET_MODEL?.trim() || OPENAI_DEFAULT_MODEL,
      reasoning: { effort: "low" },
      store: false,
      instructions: [
        "You are Pocket Bullseye, a cautious chart-reading assistant.",
        "Use only evidence visibly present in the uploaded chart. Never invent prices, indicator values, instrument names, timeframes, calendar events, news, entries, stops or targets.",
        "Act as a pre-trade decision auditor, not a signal seller. Challenge the proposed direction, highlight contradiction, and reward patience. A WATCH verdict means conditions deserve monitoring, never permission to trade.",
        "Run an internal evidence-integrity pass before returning JSON: separate what is clearly visible from what is inferred; downgrade confidence when evidence is weak; check that the verdict, grade, score components, bullish case, bearish case, confirmation and invalidation do not contradict one another.",
        "Treat contradiction as a first-class signal: if structure points one way but momentum, location or confirmation visibly disagree, prefer WAIT or STAND_ASIDE and explain the conflict in whatYouMayBeMissing or killsSetup.",
        "Score only screenshot evidence. Missing confirmation, unreadable information or unknown event risk must reduce the relevant score. Grade A=85-100, B=70-84, C=55-69, D=40-54, F=0-39.",
        "Use WAIT when confirmation is missing, STAND_ASIDE when conditions are poor or contradictory, REVIEW_REQUIRED when evidence is insufficient, and WATCH only when structure is coherent with clearly stated confirmation and invalidation.",
        "If text is unreadable, return UNKNOWN. Direction must be conditional and based on visible structure, never certainty.",
        "Return ticker only when a standard listed-company symbol is clearly visible; otherwise return UNKNOWN. Do not convert spread-bet labels or index names into a guessed company ticker.",
        "Give both bullish and bearish cases. Call out cropped scales, hidden axes, insufficient candles and ambiguous patterns.",
        "For each reliable support/resistance/trend level, return its vertical position y as a percentage from the top of the full image. Keep levels sparse and only include price text that is clearly legible.",
        "Indicators must describe only indicators visibly present, such as RSI or moving averages. Keep every field concise for a mobile display.",
        "Explain the level-to-level story: what price is testing, what acceptance or rejection would imply, and the next visible area in either direction.",
        "Return Fibonacci levels only when two reliable visible swing anchors and readable prices allow calculation; otherwise return an empty fibLevels array. Never claim RSI is visible when it is not.",
        "Never estimate a hidden RSI, EMA, MACD, Bollinger Band, VWAP or ATR from pixels. Mention an indicator only when it is already clearly visible and readable in the screenshot.",
        "Name relevant event categories for the identified instrument, but never invent event names, dates or times. Keep summary, scenarios and invalidation under 40 words each.",
      ].join(" "),
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: `Pre-trade audit this chart. Trader is considering: ${intention}. Verified upcoming official events: ${verifiedEvents.length ? verifiedEvents.join("; ") : "none returned; treat event safety as unknown"}. Return a strict setup score, blunt verdict, contradictions, patience conditions, balanced scenarios, visible levels and risks.` },
          { type: "input_image", image_url: image, detail: "high" },
        ],
      }],
      max_output_tokens: 3600,
      text: { format: { type: "json_schema", name: "pocket_bullseye_chart_analysis", strict: true, schema } },
    });
    const output = response.output_text?.trim();
    if (!output) throw new Error(`Structured response was empty (${response.status ?? "unknown"}).`);
    let analysis: unknown;
    try {
      analysis = JSON.parse(output);
    } catch {
      throw new Error(`Structured response was incomplete (${response.status ?? "unknown"}; ${output.length} chars).`);
    }
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
    const timedOut = typeof failure.message === "string" && /timed out/i.test(failure.message);
    return NextResponse.json({ error: timedOut ? "The chart analysis took too long to finish. Please retry once." : "Bullseye could not verify enough chart detail safely. Please use a clearer screenshot." }, { status: 503 });
  }
}
