import { NextResponse } from "next/server";
import { createOpenAIClient, OPENAI_DEFAULT_MODEL } from "../../../lib/server/openai";
import { getVerifiedMacroContext } from "../../../lib/verified-macro-context";
import { pocketBudgetHeaders, takePocketBudget } from "../../../lib/server/pocket-request-budget";
import { calibratePocketAnalysis } from "../analysis-calibration";

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
    evidenceQuality: {
      type: "object", additionalProperties: false,
      properties: {
        chartReadability: { type: "string", enum: ["CLEAR", "PARTIAL", "POOR"] },
        instrumentConfidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] },
        timeframeConfidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] },
        scaleReadable: { type: "boolean" },
        candlesReadable: { type: "boolean" },
        limitations: { type: "array", maxItems: 4, items: { type: "string", maxLength: 120 } },
      },
      required: ["chartReadability", "instrumentConfidence", "timeframeConfidence", "scaleReadable", "candlesReadable", "limitations"],
    },
    observableFacts: { type: "array", maxItems: 6, items: { type: "string", maxLength: 140 } },
    contradictions: { type: "array", maxItems: 4, items: { type: "string", maxLength: 140 } },
    higherTimeframe: {
      type: "object", additionalProperties: false,
      properties: {
        provided: { type: "boolean" },
        timeframe: { type: "string", maxLength: 40 },
        direction: { type: "string", enum: ["BULLISH", "BEARISH", "NEUTRAL", "UNKNOWN"] },
        alignment: { type: "string", enum: ["ALIGNED", "CONFLICTING", "MIXED", "NOT_PROVIDED"] },
        summary: { type: "string", maxLength: 240 },
      },
      required: ["provided", "timeframe", "direction", "alignment", "summary"],
    },
    patterns: {
      type: "array", maxItems: 4, items: {
        type: "object", additionalProperties: false,
        properties: {
          name: { type: "string", maxLength: 60 },
          status: { type: "string", enum: ["FORMING", "CONFIRMED", "FAILED", "AMBIGUOUS", "EXTENDED"] },
          evidence: { type: "string", maxLength: 180 },
          invalidation: { type: "string", maxLength: 160 },
        },
        required: ["name", "status", "evidence", "invalidation"],
      },
    },
    nextSequence: {
      type: "object", additionalProperties: false,
      properties: {
        now: { type: "string", maxLength: 180 },
        confirmation: { type: "string", maxLength: 180 },
        failure: { type: "string", maxLength: 180 },
        patience: { type: "string", maxLength: 180 },
        reassess: { type: "string", maxLength: 180 },
      },
      required: ["now", "confirmation", "failure", "patience", "reassess"],
    },
    missingInputs: { type: "array", maxItems: 2, items: { type: "string", maxLength: 140 } },
    contextContribution: {
      type: "object", additionalProperties: false,
      properties: {
        used: { type: "boolean" },
        materialChange: { type: "boolean" },
        summary: { type: "string", maxLength: 180 },
        resolvedInputs: { type: "array", maxItems: 3, items: { type: "string", maxLength: 100 } },
      },
      required: ["used", "materialChange", "summary", "resolvedInputs"],
    },
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
          kind: { type: "string", enum: ["support", "resistance", "trend", "pivot", "zone", "gap"] },
          label: { type: "string", maxLength: 50 },
          price: { type: "string", maxLength: 30 },
          x: { type: "number", minimum: 0, maximum: 100 },
          y: { type: "number", minimum: 0, maximum: 100 },
          x2: { type: "number", minimum: 0, maximum: 100 },
          y2: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["kind", "label", "price", "x", "y", "x2", "y2"],
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
  required: ["direction", "confidence", "instrument", "ticker", "timeframe", "evidenceQuality", "observableFacts", "contradictions", "higherTimeframe", "patterns", "nextSequence", "missingInputs", "contextContribution", "summary", "verdict", "verdictHeadline", "setupScore", "whatYouMayBeMissing", "improvesSetup", "killsSetup", "traderTrap", "bullishCase", "bearishCase", "invalidation", "marketStructure", "levelStory", "momentum", "bullConfirmation", "bearConfirmation", "noTradeCondition", "riskFlags", "indicators", "checklist", "relevantEventTypes", "levels", "fibLevels"],
} as const;

export async function POST(request: Request) {
  let image = "";
  let intention: typeof INTENTIONS[number] = "UNSURE";
  let contextImage = "";
  try {
    const payload = await request.json() as { image?: unknown; contextImage?: unknown; intention?: unknown };
    image = typeof payload.image === "string" ? payload.image : "";
    contextImage = typeof payload.contextImage === "string" ? payload.contextImage : "";
    intention = typeof payload.intention === "string" && INTENTIONS.includes(payload.intention as typeof INTENTIONS[number])
      ? payload.intention as typeof INTENTIONS[number]
      : "UNSURE";
  } catch {
    return NextResponse.json({ error: "Invalid chart upload." }, { status: 400 });
  }
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > MAX_DATA_URL_LENGTH) {
    return NextResponse.json({ error: "Please upload a valid JPEG, PNG or WebP chart under 8 MB." }, { status: 400 });
  }
  if (contextImage && (!/^data:image\/(jpeg|png|webp);base64,/.test(contextImage) || contextImage.length > MAX_DATA_URL_LENGTH)) {
    return NextResponse.json({ error: "Please use a valid higher-timeframe chart under 8 MB." }, { status: 400 });
  }
  const budget = takePocketBudget(request, "analyse");
  if (!budget.allowed) return NextResponse.json(
    { error: "Your beta analysis allowance needs a short reset. No request was sent to the AI provider." },
    { status: 429, headers: pocketBudgetHeaders(budget) },
  );
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
        "First audit input quality. Separate observableFacts (directly visible) from contradictions (evidence that conflicts with the apparent setup). State every readability limitation.",
        "If a second image is supplied, treat the first as the trading chart and the second as optional higher-timeframe context. Verify that both appear to show the same instrument; if not, mark alignment CONFLICTING and explain.",
        "Pattern labels must include status, visible evidence and invalidation. Prefer AMBIGUOUS over forcing a name. CONFIRMED requires visible completion; FORMING is incomplete; EXTENDED means the move is already mature.",
        "Build nextSequence as a practical observation timeline: what is happening now, confirmation required, failure evidence, patience condition and when another screenshot would add value.",
        "Avoid repetition across fields. Each section must add a distinct decision insight; do not restate the same support, resistance, confirmation or risk sentence in summary, cases, sequence and audit fields.",
        "missingInputs must request only information that materially changes the audit, such as a readable header, price scale, higher timeframe or volume panel. Never request everything by default.",
        "missingInputs may request only another chart view. Never request entry, stop, target, account size, trade size, risk percentage or another trader-plan field as a view.",
        "contextContribution must describe the second image only. With no second image use used=false, materialChange=false, resolvedInputs=[] and briefly state what view would help. With a second image use used=true, identify exactly what it confirmed or contradicted, list inputs it genuinely resolved, and set materialChange=true only when it changed the verdict, direction, score reasoning, visible structure or risk assessment.",
        "Instrument and timeframe confidence describe label readability, not market confidence. If either label is absent or ambiguous, use UNKNOWN and never infer it from chart shape.",
        "If chartReadability is POOR, or candles are not readable, verdict must be REVIEW_REQUIRED, confidence LOW, and the setup grade cannot exceed D. If scale is unreadable, do not return numeric prices.",
        "Act as a pre-trade decision auditor, not a signal seller. Challenge the proposed direction, highlight contradiction, and reward patience. A WATCH verdict means conditions deserve monitoring, never permission to trade.",
        "Score only screenshot evidence. Missing confirmation, unreadable information or unknown event risk must reduce the relevant score. Grade A=85-100, B=70-84, C=55-69, D=40-54, F=0-39.",
        "Use WAIT when confirmation is missing, STAND_ASIDE when conditions are poor or contradictory, REVIEW_REQUIRED when evidence is insufficient, and WATCH only when structure is coherent with clearly stated confirmation and invalidation.",
        "If text is unreadable, return UNKNOWN. Direction must be conditional and based on visible structure, never certainty.",
        "Return ticker only when a standard listed-company symbol is clearly visible; otherwise return UNKNOWN. Do not convert spread-bet labels or index names into a guessed company ticker.",
        "Give both bullish and bearish cases. Call out cropped scales, hidden axes, insufficient candles and ambiguous patterns.",
        "observableFacts must contain no more than three decision-useful facts: identified chart context, visible price structure, and the current test or reaction. Do not inventory gridlines, axis ticks, footer statistics or decorative interface text.",
        "For each reliable overlay return image-relative percentage geometry x,y to x2,y2. Support/resistance are horizontal lines spanning only the visible plotted price area. Trend uses two visible swing anchors. Pivot uses the same start/end point at the exact swing. Zone and gap use opposite corners of a tightly bounded rectangle. Coordinates refer to the full uploaded image, not a crop. Keep overlays sparse and include price text only when clearly legible.",
        "Use pivot only for a conspicuous swing high or low, zone only for a visibly repeated reaction area, and gap only for a clearly visible unfilled price gap or imbalance. Never add an overlay merely to fill the chart.",
        "Indicators must describe only indicators visibly present, such as RSI or moving averages. Keep every field concise for a mobile display.",
        "Explain the level-to-level story: what price is testing, what acceptance or rejection would imply, and the next visible area in either direction.",
        "Return Fibonacci levels only when two reliable visible swing anchors and readable prices allow calculation; otherwise return an empty fibLevels array. Never claim RSI is visible when it is not.",
        "Never estimate a hidden RSI, EMA, MACD, Bollinger Band, VWAP or ATR from pixels. Mention an indicator only when it is already clearly visible and readable in the screenshot.",
        "Name relevant event categories for the identified instrument, but never invent event names, dates or times. Keep summary, scenarios and invalidation under 40 words each.",
      ].join(" "),
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: `Pre-trade audit the first trading chart${contextImage ? " and compare the optional second higher-timeframe chart" : ""}. Trader is considering: ${intention}. Verified upcoming official events: ${verifiedEvents.length ? verifiedEvents.join("; ") : "none returned; treat event safety as unknown"}. Return a strict setup score, blunt verdict, multi-timeframe alignment, pattern status, next-event sequence, only-material missing inputs, visible levels and risks.` },
          { type: "input_image", image_url: image, detail: "high" },
          ...(contextImage ? [{ type: "input_image" as const, image_url: contextImage, detail: "high" as const }] : []),
        ],
      }],
      max_output_tokens: 4400,
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
    return NextResponse.json(
      { analysis: calibratePocketAnalysis(analysis) },
      { headers: pocketBudgetHeaders(budget) },
    );
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
