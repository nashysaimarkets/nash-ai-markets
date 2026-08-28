import { NextResponse } from "next/server";
import { createOpenAIClient, OPENAI_DEFAULT_MODEL } from "../../../lib/server/openai";
import { getVerifiedMacroContext } from "../../../lib/verified-macro-context";
import { pocketBudgetHeaders, takePocketBudget } from "../../../lib/server/pocket-request-budget";
import { calibratePocketAnalysis } from "../analysis-calibration";
import { recoverPrecisionGeometry } from "../precision-fallback";
import { choosePrecisionLiquidityShield, correctedCurrentPrice, insufficientLiquidityShield, isPlainNumericPrice, normalizePrecisionLiquidityShield, numericPrice } from "../liquidity-precision";

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
          timeframe: { type: "string", maxLength: 20 },
          confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          evidence: { type: "string", maxLength: 180 },
          confirmation: { type: "string", maxLength: 160 },
          invalidation: { type: "string", maxLength: 160 },
          geometry: {
            type: "object", additionalProperties: false,
            properties: {
              points: { type: "array", minItems: 2, maxItems: 10, items: {
                type: "object", additionalProperties: false,
                properties: { x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 } },
                required: ["x", "y"],
              } },
              labelX: { type: "number", minimum: 0, maximum: 100 },
              labelY: { type: "number", minimum: 0, maximum: 100 },
            },
            required: ["points", "labelX", "labelY"],
          },
        },
        required: ["name", "status", "timeframe", "confidence", "evidence", "confirmation", "invalidation", "geometry"],
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
    plotBounds: {
      type: "object", additionalProperties: false,
      properties: {
        left: { type: "number", minimum: 0, maximum: 100 }, top: { type: "number", minimum: 0, maximum: 100 },
        right: { type: "number", minimum: 0, maximum: 100 }, bottom: { type: "number", minimum: 0, maximum: 100 },
      },
      required: ["left", "top", "right", "bottom"],
    },
    priceScaleAnchors: {
      type: "array", maxItems: 4, items: {
        type: "object", additionalProperties: false,
        properties: { price: { type: "number" }, y: { type: "number", minimum: 0, maximum: 100 } },
        required: ["price", "y"],
      },
    },
    levels: {
      type: "array", maxItems: 8, items: {
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
  required: ["direction", "confidence", "instrument", "ticker", "timeframe", "evidenceQuality", "observableFacts", "contradictions", "higherTimeframe", "patterns", "nextSequence", "missingInputs", "contextContribution", "summary", "verdict", "verdictHeadline", "setupScore", "whatYouMayBeMissing", "improvesSetup", "killsSetup", "traderTrap", "bullishCase", "bearishCase", "invalidation", "marketStructure", "levelStory", "momentum", "bullConfirmation", "bearConfirmation", "noTradeCondition", "riskFlags", "indicators", "checklist", "relevantEventTypes", "plotBounds", "priceScaleAnchors", "levels", "fibLevels"],
} as const;

const precisionOverlaySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    plotBounds: schema.properties.plotBounds,
    priceScaleAnchors: schema.properties.priceScaleAnchors,
    levels: schema.properties.levels,
    currentPrice: { type: "string", maxLength: 30 },
    liquidityShield: {
      type: "object", additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["VISIBLE_RISK_ZONES", "NO_VISIBLE_RISK_ZONES", "INSUFFICIENT_EVIDENCE"] },
        summary: { type: "string", maxLength: 220 },
        zones: {
          type: "array", maxItems: 4, items: {
            type: "object", additionalProperties: false,
            properties: {
              side: { type: "string", enum: ["ABOVE_PRICE", "BELOW_PRICE"] },
              pattern: { type: "string", enum: ["EQUAL_HIGHS", "EQUAL_LOWS", "SWING_CLUSTER", "RANGE_EDGE", "SESSION_EXTREME", "ROUND_NUMBER"] },
              label: { type: "string", maxLength: 48 },
              priceLow: { type: "number" },
              priceHigh: { type: "number" },
              confidence: { type: "string", enum: ["HIGH", "MEDIUM"] },
              evidence: { type: "string", maxLength: 160 },
              touchPoints: {
                type: "array", minItems: 2, maxItems: 6, items: {
                  type: "object", additionalProperties: false,
                  properties: {
                    x: { type: "number", minimum: 0, maximum: 100 },
                    y: { type: "number", minimum: 0, maximum: 100 },
                  },
                  required: ["x", "y"],
                },
              },
            },
            required: ["side", "pattern", "label", "priceLow", "priceHigh", "confidence", "evidence", "touchPoints"],
          },
        },
        stopGuidance: { type: "string", maxLength: 220 },
      },
      required: ["status", "summary", "zones", "stopGuidance"],
    },
    confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    limitation: { type: "string", maxLength: 160 },
  },
  required: ["plotBounds", "priceScaleAnchors", "levels", "currentPrice", "liquidityShield", "confidence", "limitation"],
} as const;

export async function POST(request: Request) {
  let image = "";
  let intention: typeof INTENTIONS[number] = "UNSURE";
  let contextImage = "";
  let precisionImage = "";
  let contextPrecisionImage = "";
  let chartConfirmation: { instrument: string; timeframe: string; currentPrice: string; contextMatch: "MATCHED" | "NOT_PROVIDED" } | null = null;
  let accuracyCorrection: { categories: string[]; correction: string; note: string } | null = null;
  try {
    const payload = await request.json() as { image?: unknown; contextImage?: unknown; precisionImage?: unknown; contextPrecisionImage?: unknown; intention?: unknown; chartConfirmation?: unknown; accuracyCorrection?: unknown };
    image = typeof payload.image === "string" ? payload.image : "";
    contextImage = typeof payload.contextImage === "string" ? payload.contextImage : "";
    precisionImage = typeof payload.precisionImage === "string" ? payload.precisionImage : "";
    contextPrecisionImage = typeof payload.contextPrecisionImage === "string" ? payload.contextPrecisionImage : "";
    intention = typeof payload.intention === "string" && INTENTIONS.includes(payload.intention as typeof INTENTIONS[number])
      ? payload.intention as typeof INTENTIONS[number]
      : "UNSURE";
    if (payload.chartConfirmation && typeof payload.chartConfirmation === "object") {
      const candidate = payload.chartConfirmation as Record<string, unknown>;
      const instrument = typeof candidate.instrument === "string" ? candidate.instrument.trim().slice(0, 40) : "";
      const timeframe = typeof candidate.timeframe === "string" ? candidate.timeframe.trim().slice(0, 30) : "";
      const currentPrice = typeof candidate.currentPrice === "string" ? candidate.currentPrice.trim().slice(0, 30) : "";
      const contextMatch = candidate.contextMatch === "MATCHED" ? "MATCHED" : "NOT_PROVIDED";
      if (instrument && timeframe && isPlainNumericPrice(currentPrice)) chartConfirmation = { instrument, timeframe, currentPrice, contextMatch };
    }
    if (payload.accuracyCorrection && typeof payload.accuracyCorrection === "object") {
      const candidate = payload.accuracyCorrection as Record<string, unknown>;
      const allowed = new Set(["INSTRUMENT", "TIMEFRAME", "CURRENT_PRICE", "SUPPORT", "RESISTANCE", "CHART_READING"]);
      const categories = Array.isArray(candidate.categories) ? candidate.categories.filter((value): value is string => typeof value === "string" && allowed.has(value)).slice(0, 6) : [];
      const correction = typeof candidate.correction === "string" ? candidate.correction.trim().slice(0, 80) : "";
      const note = typeof candidate.note === "string" ? candidate.note.trim().slice(0, 180) : "";
      if (categories.length) accuracyCorrection = { categories, correction, note };
    }
  } catch {
    return NextResponse.json({ error: "Invalid chart upload." }, { status: 400 });
  }
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > MAX_DATA_URL_LENGTH) {
    return NextResponse.json({ error: "Please upload a valid JPEG, PNG or WebP chart under 8 MB." }, { status: 400 });
  }
  if (contextImage && (!/^data:image\/(jpeg|png|webp);base64,/.test(contextImage) || contextImage.length > MAX_DATA_URL_LENGTH)) {
    return NextResponse.json({ error: "Please use a valid higher-timeframe chart under 8 MB." }, { status: 400 });
  }
  if ([precisionImage, contextPrecisionImage].some((value) => value && (!/^data:image\/(jpeg|png|webp);base64,/.test(value) || value.length > MAX_DATA_URL_LENGTH))) {
    return NextResponse.json({ error: "The chart reading crop could not be prepared safely." }, { status: 400 });
  }
  const budget = takePocketBudget(request, "analyse");
  if (!budget.allowed) return NextResponse.json(
    { error: "Your beta analysis allowance needs a short reset. No request was sent to the AI provider." },
    { status: 429, headers: pocketBudgetHeaders(budget) },
  );
  const client = createOpenAIClient(undefined, POCKET_ANALYSIS_TIMEOUT_MS);
  if (!client) return NextResponse.json({ error: "AI analysis is not connected in this environment." }, { status: 503 });

  try {
    // A current-price correction is the trader's newest explicit fact and takes
    // precedence over preflight confirmation, which in turn outranks OCR.
    const authoritativeCurrentPrice = correctedCurrentPrice(accuracyCorrection) ?? chartConfirmation?.currentPrice ?? null;
    const macroContext = await getVerifiedMacroContext({ route: "/api/pocket/analyse" });
    const verifiedEvents = macroContext.releases.slice(0, 4).map((event) => `${event.name} (${event.agency}) at ${event.scheduledAt}, ${event.risk} impact`);
    const model = process.env.OPENAI_POCKET_MODEL?.trim() || OPENAI_DEFAULT_MODEL;
    const analysisRequest = client.responses.create({
      model,
      reasoning: { effort: "low" },
      store: false,
      instructions: [
        "You are Pocket Bullseye, a cautious chart-reading assistant.",
        "Use only evidence visibly present in the uploaded chart. Never invent prices, indicator values, instrument names, timeframes, calendar events, news, entries, stops or targets.",
        "When user-confirmed chart facts are provided, treat their instrument, timeframe and current-price marker as authoritative metadata. Do not override them with a visual label guess. Still derive all structure, levels and directional reasoning independently from visible chart evidence.",
        "When a user correction is provided, explicitly re-check that category against the chart. Treat a corrected numeric support, resistance or current price as user-verified and rebuild the audit around it. Do not invent additional corrected levels.",
        "First audit input quality. Separate observableFacts (directly visible) from contradictions (evidence that conflicts with the apparent setup). State every readability limitation.",
        "If a second image is supplied, treat the first as the trading chart and the second as optional higher-timeframe context. Re-evaluate and replace the entire audit using both images, including support/resistance commentary, missing inputs, score and verdict. Verify that both appear to show the same instrument; if not, mark alignment CONFLICTING and explain.",
        "Pattern Watch may name only structures visibly supported by candle geometry. Use exactly these gallery names: HEAD & SHOULDERS, INVERSE H&S, RISING WEDGE, FALLING WEDGE, BULL FLAG, BEAR FLAG, DOUBLE TOP, DOUBLE BOTTOM, TRIANGLE, ASCENDING TRIANGLE, DESCENDING TRIANGLE, PENNANT, CUP & HANDLE, RECTANGLE / RANGE, TREND CHANNEL, BREAKOUT & RETEST. Each pattern must include its visible timeframe, confidence, evidence, confirmation condition, invalidation and image-relative geometry. Geometry points must trace the actual visible swing path on the full uploaded image and labelX/labelY must sit beside—not over—the candles. Prefer AMBIGUOUS over forcing a name. HIGH confidence requires a clear completed geometry plus visible confirmation; FORMING is incomplete; CONFIRMED requires the visible neckline/boundary break or other completion; FAILED means invalidation is already visible; EXTENDED means the confirmed move is mature. Do not call ordinary noise a pattern and return an empty array when none is defensible.",
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
        "Return plotBounds around only the candle plotting rectangle, excluding phone chrome, order tickets, headers, axes, footer statistics and volume panels. Return 2-4 priceScaleAnchors from clearly readable axis labels with their full-image y percentages; otherwise return an empty array.",
        "When candles and scale are readable, prioritise up to two meaningful supports, two resistances and up to three conspicuous pivot swing highs/lows. Do not omit a clear pivot merely because support and resistance were also returned. Never force a level where the chart lacks a visible reaction.",
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
          { type: "input_text", text: `Pre-trade audit the first trading chart${contextImage ? " and compare the optional second higher-timeframe chart" : ""}. Trader-confirmed chart facts: ${chartConfirmation ? `instrument=${chartConfirmation.instrument}; timeframe=${chartConfirmation.timeframe}; current price=${chartConfirmation.currentPrice}; context=${chartConfirmation.contextMatch}` : "none"}. User correction replay: ${accuracyCorrection ? `categories=${accuracyCorrection.categories.join(",")}; corrected value=${accuracyCorrection.correction || "not supplied"}; note=${accuracyCorrection.note || "none"}` : "none"}. Trader is considering: ${intention}. Verified upcoming official events: ${verifiedEvents.length ? verifiedEvents.join("; ") : "none returned; treat event safety as unknown"}. Return a strict setup score, blunt verdict, multi-timeframe alignment, pattern status, next-event sequence, only-material missing inputs, visible levels and risks.` },
          { type: "input_image", image_url: image, detail: "high" },
          ...(contextImage ? [{ type: "input_image" as const, image_url: contextImage, detail: "high" as const }] : []),
        ],
      }],
      // Structured reports can exceed the old cap when two charts contribute
      // distinct evidence. Reasoning tokens also count toward this allowance.
      max_output_tokens: 7000,
      text: { format: { type: "json_schema", name: "pocket_bullseye_chart_analysis", strict: true, schema } },
    });
    const precisionInstructions = [
        "You are the precision chart-geometry pass for Pocket Bullseye. Analyse only the first uploaded chart image.",
        "Return geometry in percentages of the complete uploaded image. Do not write a market report and do not infer hidden values.",
        "plotBounds must tightly enclose only the candle plotting rectangle. Exclude phone chrome, chart headers, order tickets, price-axis labels, dates, footer data, indicator panels and volume panels.",
        "Read 3-4 clearly printed prices from the visible price axis when possible and return each exact numeric price with the y coordinate through the centre of its label. Higher prices must have smaller y coordinates and all anchors must form one linear scale. Two exact labels are acceptable only when widely separated vertically and every returned level's visible reaction row agrees with the resulting projection. With fewer than two exact labels, return no support or resistance levels.",
        "Return currentPrice only when the chart's current-price marker is clearly readable; otherwise return an empty string.",
        "Return one or two structural levels below current price and one or two above it whenever the visible scale and candles support them. A defended swing, breakout shelf, prior range edge or repeated reaction area is sufficient; repeated touches are not mandatory. Classify every horizontal level by location: below current is support and above current is resistance.",
        "Return up to three conspicuous pivot swing highs or lows at the wick extremity. Pivot x/y and x2/y2 must be identical.",
        "Support and resistance are horizontal from plotBounds.left to plotBounds.right. Never use current-price guide lines, screen edges, phone UI, order prices or volume bars as market levels.",
        "For every level, y must mark the actual visible candle reaction and must also agree with the price projected from the three-point scale. Prefer an empty levels array to false precision. Keep label and price terse; no prose overlays.",
        "Liquidity Guard identifies only visually inferred stop-risk clusters at equal highs, equal lows, clustered swing points, range edges, session extremes or an obviously respected round number. It never verifies resting orders, order-book liquidity or institutional intent.",
        "For Liquidity Guard, require at least three consistent price-scale anchors and a readable current price. VISIBLE_RISK_ZONES requires at least one candidate with two or more genuinely visible, horizontally separated candle touchPoints. Otherwise return NO_VISIBLE_RISK_ZONES when the chart is readable and no cluster exists, or INSUFFICIENT_EVIDENCE when exact scale, current price or candle rows cannot be verified.",
        "Each liquidity zone must use numeric priceLow and priceHigh from the visible scale. For one exact price set both equal. Every touchPoint must mark the actual full-image wick or candle reaction that creates the cluster, and each touchPoint y must agree with the price band projected through the returned scale. side is relative to currentPrice and the complete band must remain on that side. Never fabricate width, touches or price precision.",
        "Liquidity confidence may be HIGH only for three or more clean aligned reactions with a consistent scale; use MEDIUM for two clear reactions. Low-confidence candidates must be omitted rather than drawn. stopGuidance must discuss structurally decisive invalidation without giving a personal stop price or promising a reversal.",
      ].join(" ");
    const requestPrecision = (chartImage: string, rescue = false, readingCrop: string | null = null, trustedCurrentPrice: string | null = null) => client.responses.create({
      model: process.env.OPENAI_POCKET_ANNOTATION_MODEL?.trim() || model,
      reasoning: { effort: "low" },
      store: false,
      instructions: precisionInstructions,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: `${trustedCurrentPrice ? `The trader-verified current price is ${trustedCurrentPrice}; return it exactly and use it for every above/below classification. ` : ""}${rescue
            ? `Retry the chart carefully. ${readingCrop ? "The second image is an enlarged reading crop of the first chart; use it to read candles and the right-hand price scale, but return coordinates relative to the complete first image." : ""} Read the visible scale, current-price badge, major swing geometry and only defensible Liquidity Guard touch clusters. Return the nearest defensible structural level below current as support and above current as resistance when visible. A major defended swing low/high, breakout shelf or prior range edge is sufficient; repeated reactions are not mandatory. Never invent a hidden price.`
            : "Extract independently verifiable support, resistance, pivot and Liquidity Guard geometry from this chart. Accuracy is more important than quantity."}` },
          { type: "input_image", image_url: chartImage, detail: "high" },
          ...(readingCrop ? [{ type: "input_image" as const, image_url: readingCrop, detail: "high" as const }] : []),
        ],
      }],
      max_output_tokens: 2200,
      text: { format: { type: "json_schema", name: "pocket_bullseye_precision_overlays", strict: true, schema: precisionOverlaySchema } },
    });
    const safePrecision = async (chartImage: string, label: string, readingCrop: string | null, trustedCurrentPrice: string | null = null) => {
      try {
        const first = await requestPrecision(chartImage, false, null, trustedCurrentPrice);
        try {
          const parsed = first.output_text ? JSON.parse(first.output_text) as Record<string, unknown> : null;
          if (parsed && Array.isArray(parsed.levels)) {
            const currentSource = trustedCurrentPrice ?? (typeof parsed.currentPrice === "string" ? parsed.currentPrice : "");
            const current = numericPrice(currentSource) ?? NaN;
            const prices = parsed.levels.flatMap((level) => {
              if (!level || typeof level !== "object") return [];
              const price = numericPrice((level as Record<string, unknown>).price);
              return price !== null ? [price] : [];
            });
            const missingSide = !Number.isFinite(current) || !prices.some((price) => price < current) || !prices.some((price) => price > current);
            const shield = parsed.liquidityShield && typeof parsed.liquidityShield === "object" ? parsed.liquidityShield as Record<string, unknown> : null;
            const missingLiquidity = !shield || shield.status === "INSUFFICIENT_EVIDENCE" || (shield.status === "VISIBLE_RISK_ZONES" && (!Array.isArray(shield.zones) || shield.zones.length === 0));
            if (parsed.levels.length === 0 || missingSide || missingLiquidity) {
              const rescue = await requestPrecision(chartImage, true, readingCrop, trustedCurrentPrice);
              const rescued = rescue.output_text ? JSON.parse(rescue.output_text) as Record<string, unknown> : null;
              if (rescued) {
                const merged = recoverPrecisionGeometry(parsed, rescued);
                return { output_text: JSON.stringify({
                  ...(merged ?? rescued),
                  liquidityShield: choosePrecisionLiquidityShield(parsed.liquidityShield, rescued.liquidityShield),
                }) };
              }
            }
          }
        } catch { /* The normal parse/fail-closed path below handles malformed output. */ }
        return first;
      } catch (error) {
        console.error(`[pocket-bullseye] ${label} precision pass unavailable`, error instanceof Error ? error.message : "unknown");
        return null;
      }
    };
    const [response, precisionResult, contextPrecisionResult] = await Promise.all([
      analysisRequest,
      safePrecision(image, "primary", precisionImage || null, authoritativeCurrentPrice),
      contextImage ? safePrecision(contextImage, "context", contextPrecisionImage || null) : Promise.resolve(null),
    ]);
    const output = response.output_text?.trim();
    if (!output) throw new Error(`Structured response was empty (${response.status ?? "unknown"}).`);
    let analysis: unknown;
    try {
      analysis = JSON.parse(output);
    } catch {
      throw new Error(`Structured response was incomplete (${response.status ?? "unknown"}; ${output.length} chars).`);
    }
    if (analysis && typeof analysis === "object") {
      let precision: unknown = null;
      let contextPrecision: unknown = null;
      const parsePrecision = (outputText: string | undefined) => {
        try { return outputText ? JSON.parse(outputText) as unknown : null; }
        catch { return null; }
      };
      precision = parsePrecision(precisionResult?.output_text);
      contextPrecision = parsePrecision(contextPrecisionResult?.output_text);
      const record = analysis as Record<string, unknown>;
      const precisionRecord = precision && typeof precision === "object" ? precision as Record<string, unknown> : null;
      const ocrCurrentPrice = typeof precisionRecord?.currentPrice === "string" && isPlainNumericPrice(precisionRecord.currentPrice)
        ? precisionRecord.currentPrice
        : "";
      const resolvedCurrentPrice = authoritativeCurrentPrice ?? ocrCurrentPrice;
      const liquidityShield = normalizePrecisionLiquidityShield(precisionRecord, resolvedCurrentPrice || null);
      precision = recoverPrecisionGeometry(record, precisionRecord);
      if (precision && typeof precision === "object") {
        const geometry = precision as Record<string, unknown>;
        analysis = {
          ...record,
          plotBounds: geometry.plotBounds,
          priceScaleAnchors: geometry.priceScaleAnchors,
          levels: geometry.levels,
          currentPrice: resolvedCurrentPrice,
          liquidityShield,
          contextBattlefield: contextPrecision && typeof contextPrecision === "object" ? {
            levels: (contextPrecision as Record<string, unknown>).levels,
            currentPrice: (contextPrecision as Record<string, unknown>).currentPrice,
            priceScaleAnchors: (contextPrecision as Record<string, unknown>).priceScaleAnchors,
            plotBounds: (contextPrecision as Record<string, unknown>).plotBounds,
          } : null,
        };
      } else {
        // Fail closed: a report may still be useful, but unverified geometry must never be drawn.
        analysis = {
          ...record,
          currentPrice: resolvedCurrentPrice,
          priceScaleAnchors: [],
          levels: [],
          liquidityShield: insufficientLiquidityShield("The precision chart-reading pass did not complete, so no liquidity zone was drawn."),
        };
      }
    }
    const calibrated = calibratePocketAnalysis(analysis) as Record<string, unknown>;
    console.info("[pocket-bullseye] calibrated geometry", JSON.stringify({
      primaryAnchors: Array.isArray(calibrated.priceScaleAnchors) ? calibrated.priceScaleAnchors.length : 0,
      primaryLevels: Array.isArray(calibrated.levels) ? calibrated.levels.length : 0,
      scaleReadable: (calibrated.evidenceQuality as Record<string, unknown> | undefined)?.scaleReadable ?? null,
      precisionCrop: Boolean(precisionImage),
      contextCrop: Boolean(contextPrecisionImage),
    }));
    const contextBattlefield = calibrated?.contextBattlefield;
    if (contextBattlefield && typeof contextBattlefield === "object") {
      const context = contextBattlefield as Record<string, unknown>;
      const contextCalibrated = calibratePocketAnalysis({
        ...calibrated,
        plotBounds: context.plotBounds,
        priceScaleAnchors: context.priceScaleAnchors,
        levels: context.levels,
        currentPrice: context.currentPrice,
      }) as Record<string, unknown>;
      calibrated.contextBattlefield = { ...context, levels: contextCalibrated.levels };
    }
    return NextResponse.json(
      { analysis: calibrated },
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
    const message = typeof failure.message === "string" ? failure.message : "";
    const timedOut = /timed out/i.test(message);
    const incomplete = /structured response was (?:empty|incomplete)/i.test(message);
    return NextResponse.json({ error: timedOut
      ? "The chart analysis took too long to finish. Please retry once."
      : incomplete
        ? "The analysis report was interrupted before it finished. Your chart is still loaded—please retry once."
        : "Bullseye could not verify enough chart detail safely. Please use a clearer screenshot." }, { status: 503 });
  }
}
