import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { canonicalizePocketGeometry } from "../../../lib/pocket-geometry";
import { classifyOpenAIFailure, createOpenAIClient, OPENAI_DEFAULT_MODEL } from "../../../lib/server/openai";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../lib/server/bounded-json-body";
import { pocketBudgetHeaders, takePocketBudget } from "../../../lib/server/pocket-request-budget";
import { rejectCrossOrigin } from "../../../lib/server/same-origin";
import { validateLevelLabPrimaryProvenance } from "../level-lab-validation";
import { normalizePrecisionLiquidityShield, numericPrice } from "../liquidity-precision";
import { instrumentIdentitiesMatch } from "../precision-structure";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_DATA_URL_LENGTH = 3_800_000;
const MAX_REQUEST_BYTES = MAX_DATA_URL_LENGTH + 32_768;
const PROVIDER_TIMEOUT_MS = 48_000;
const REPLAY_TTL_MS = 2 * 60_000;
type CachedResult = { expiresAt: number; status: number; payload: Record<string, unknown> };
const completed = new Map<string, CachedResult>();
const inFlight = new Map<string, Promise<CachedResult>>();

const geometry = {
  plotBounds: { type: "object", additionalProperties: false, properties: { left: { type: "number", minimum: 0, maximum: 100 }, top: { type: "number", minimum: 0, maximum: 100 }, right: { type: "number", minimum: 0, maximum: 100 }, bottom: { type: "number", minimum: 0, maximum: 100 } }, required: ["left", "top", "right", "bottom"] },
  priceScaleAnchors: { type: "array", minItems: 2, maxItems: 4, items: { type: "object", additionalProperties: false, properties: { price: { type: "number" }, y: { type: "number", minimum: 0, maximum: 100 } }, required: ["price", "y"] } },
} as const;

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    instrumentIdentifier: { type: "string", maxLength: 80 },
    instrumentConfidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] },
    timeframe: { type: "string", maxLength: 30 },
    timeframeConfidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] },
    currentPrice: { type: "string", maxLength: 30 },
    candlesReadable: { type: "boolean" },
    priceScaleReadable: { type: "boolean" },
    plotBounds: geometry.plotBounds,
    priceScaleAnchors: geometry.priceScaleAnchors,
    liquidityShield: {
      type: "object", additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["VISIBLE_RISK_ZONES", "NO_VISIBLE_RISK_ZONES", "INSUFFICIENT_EVIDENCE"] },
        summary: { type: "string", maxLength: 220 },
        zones: { type: "array", maxItems: 4, items: {
          type: "object", additionalProperties: false,
          properties: {
            side: { type: "string", enum: ["ABOVE_PRICE", "AT_PRICE", "BELOW_PRICE"] },
            pattern: { type: "string", enum: ["EQUAL_HIGHS", "EQUAL_LOWS", "SWING_CLUSTER", "RANGE_EDGE", "SESSION_EXTREME", "ROUND_NUMBER"] },
            label: { type: "string", maxLength: 48 }, priceLow: { type: "number" }, priceHigh: { type: "number" },
            confidence: { type: "string", enum: ["HIGH", "MEDIUM"] }, evidence: { type: "string", maxLength: 160 },
            touchPoints: { type: "array", minItems: 2, maxItems: 6, items: { type: "object", additionalProperties: false, properties: { x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 } }, required: ["x", "y"] } },
          },
          required: ["side", "pattern", "label", "priceLow", "priceHigh", "confidence", "evidence", "touchPoints"],
        } },
        stopGuidance: { type: "string", maxLength: 220 },
      },
      required: ["status", "summary", "zones", "stopGuidance"],
    },
    confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    limitation: { type: "string", maxLength: 160 },
  },
  required: ["instrumentIdentifier", "instrumentConfidence", "timeframe", "timeframeConfidence", "currentPrice", "candlesReadable", "priceScaleReadable", "plotBounds", "priceScaleAnchors", "liquidityShield", "confidence", "limitation"],
} as const;

const calibrationSchema = {
  type: "object", additionalProperties: false,
  properties: {
    instrumentIdentifier: { type: "string", maxLength: 80 },
    instrumentConfidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] },
    timeframe: { type: "string", maxLength: 30 },
    timeframeConfidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] },
    currentPrice: { type: "string", maxLength: 30 },
    candlesReadable: { type: "boolean" },
    priceScaleReadable: { type: "boolean" },
    plotBounds: geometry.plotBounds,
    priceScaleAnchors: geometry.priceScaleAnchors,
    confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    limitation: { type: "string", maxLength: 160 },
  },
  required: ["instrumentIdentifier", "instrumentConfidence", "timeframe", "timeframeConfidence", "currentPrice", "candlesReadable", "priceScaleReadable", "plotBounds", "priceScaleAnchors", "confidence", "limitation"],
} as const;

function requestKey(request: Request, image: string, provenance: unknown) {
  const id = request.headers.get("x-pocket-request-id")?.trim() ?? "";
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id)) return null;
  return createHash("sha256").update(id).update("\0").update(image).update("\0").update(JSON.stringify(provenance)).digest("hex");
}

function compatiblePrice(expected: string, returned: unknown) {
  const left = numericPrice(expected), right = numericPrice(returned);
  return left !== null && right !== null && Math.abs(left - right) <= Math.max(Math.abs(left) * .0015, .01);
}

function compatibleTimeframe(expected: string, returned: unknown) {
  const normalize = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "") : "";
  const left = normalize(expected), right = normalize(returned);
  return Boolean(left && right && left === right);
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  let image = "";
  let rawProvenance: unknown = null;
  try {
    const payload = await readBoundedJsonBody(request, MAX_REQUEST_BYTES) as { image?: unknown; primaryProvenance?: unknown };
    image = typeof payload.image === "string" ? payload.image : "";
    rawProvenance = payload.primaryProvenance;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "The Liquidity Guard request is too large." }, { status: 413 });
    return NextResponse.json({ error: "Invalid chart upload." }, { status: 400 });
  }
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > MAX_DATA_URL_LENGTH) return NextResponse.json({ error: "The prepared Liquidity Guard chart is not a valid, safely sized image." }, { status: 400 });
  const provenance = validateLevelLabPrimaryProvenance(rawProvenance);
  if (!provenance) return NextResponse.json({ error: "Liquidity Guard needs the verified primary instrument, timeframe and current price." }, { status: 409 });

  const now = Date.now();
  for (const [key, item] of completed) if (item.expiresAt <= now) completed.delete(key);
  const key = requestKey(request, image, provenance);
  const replay = key ? completed.get(key) : null;
  if (replay && replay.expiresAt > now) return NextResponse.json(replay.payload, { status: replay.status, headers: { "cache-control": "no-store", "x-pocket-idempotent-replay": "1" } });
  const running = key ? inFlight.get(key) : null;
  if (running) {
    const result = await running;
    return NextResponse.json(result.payload, { status: result.status, headers: { "cache-control": "no-store", "x-pocket-idempotent-replay": "in-flight" } });
  }
  const budget = takePocketBudget(request, "liquidity");
  if (!budget.allowed) return NextResponse.json({ error: "Liquidity Guard needs a short reset." }, { status: 429, headers: pocketBudgetHeaders(budget) });
  const client = createOpenAIClient(undefined, PROVIDER_TIMEOUT_MS);
  if (!client) return NextResponse.json({ error: "AI liquidity scanning is not connected in this environment." }, { status: 503 });

  console.info("[pocket-bullseye] liquidity rescan start", JSON.stringify({ imageChars: image.length }));
  const work = (async (): Promise<CachedResult> => {
    try {
      const sharedInput = [{ role: "user" as const, content: [
        { type: "input_text" as const, text: `Verify Liquidity Guard for the primary chart. Expected identity=${provenance.instrument}; ticker=${provenance.ticker || "not supplied"}; timeframe=${provenance.timeframe}; current-price reference=${provenance.currentPrice}. These expected values are compatibility checks only.` },
        { type: "input_image" as const, image_url: image, detail: "high" as const },
      ] }];
      const [response, calibrationResponse] = await Promise.all([client.responses.create({
        model: process.env.OPENAI_POCKET_ANNOTATION_MODEL?.trim() || process.env.OPENAI_POCKET_MODEL?.trim() || OPENAI_DEFAULT_MODEL,
        reasoning: { effort: "low" }, store: false,
        instructions: [
          "You are Pocket Bullseye Liquidity Guard. Analyse only the uploaded primary chart and only visible stop-risk clusters.",
          "Read the exact instrument title and current-price marker independently. Never copy them from the expected values unless visible.",
          "Return timeframe exactly as visibly printed on this chart and timeframeConfidence HIGH only when that label is clear.",
          "candlesReadable is true only when the relevant wick and candle reactions are discernible. priceScaleReadable is true only when multiple consistent printed axis labels are legible.",
          "Return full-image percentage coordinates. plotBounds encloses the candle plot only. Read 3-4 widely separated printed price-axis labels when possible.",
          "A visible risk zone requires at least two distinct candle or wick reactions on the same narrow price row. Equal highs, equal lows, a repeated swing cluster or a well-tested range edge qualify. A single wick, forecast or merely plausible area does not.",
          "Every touchPoint must sit on an actual visible wick or candle reaction and agree with the price band projected through the returned scale.",
          "Use ABOVE_PRICE, BELOW_PRICE or AT_PRICE literally relative to the visible current-price marker. Prefer one or two strong zones over weak clutter.",
          "NO_VISIBLE_RISK_ZONES means the scan completed with a verified scale but no repeated cluster. INSUFFICIENT_EVIDENCE means identity, price, scale or candle rows could not be verified.",
        ].join(" "),
        input: sharedInput,
        max_output_tokens: 1500,
        text: { format: { type: "json_schema", name: "pocket_liquidity_guard_rescan", strict: true, schema } },
      }, { timeout: PROVIDER_TIMEOUT_MS }), client.responses.create({
        model: process.env.OPENAI_POCKET_ANNOTATION_MODEL?.trim() || process.env.OPENAI_POCKET_MODEL?.trim() || OPENAI_DEFAULT_MODEL,
        reasoning: { effort: "low" }, store: false,
        instructions: [
          "Independently calibrate only the uploaded chart's visible candle plot and printed price axis.",
          "Read the instrument, timeframe and current-price marker from the image. Expected values are compatibility checks only.",
          "Return full-image percentage coordinates. plotBounds encloses only the candle plot, excluding phone chrome, headers, axes, tickets, dates and footer statistics.",
          "Return 3-4 widely separated printed price-axis labels with the y coordinate through the vertical centre of each printed number. Never infer missing labels or reuse coordinates from another response.",
          "priceScaleReadable is false and confidence LOW unless at least three printed labels can be independently located.",
        ].join(" "),
        input: sharedInput,
        max_output_tokens: 700,
        text: { format: { type: "json_schema", name: "pocket_liquidity_axis_calibration", strict: true, schema: calibrationSchema } },
      }, { timeout: PROVIDER_TIMEOUT_MS })]);
      const output = response.output_text?.trim();
      const calibrationOutput = calibrationResponse.output_text?.trim();
      if (!output || !calibrationOutput) throw new Error("empty_liquidity_result");
      const raw = canonicalizePocketGeometry(JSON.parse(output)) as Record<string, unknown>;
      const calibration = canonicalizePocketGeometry(JSON.parse(calibrationOutput)) as Record<string, unknown>;
      const identityMatch = raw.instrumentConfidence === "HIGH" && instrumentIdentitiesMatch([provenance.instrument, provenance.ticker], raw.instrumentIdentifier) === true;
      const timeframeMatch = raw.timeframeConfidence === "HIGH" && compatibleTimeframe(provenance.timeframe, raw.timeframe);
      const calibrationIdentityMatch = calibration.instrumentConfidence === "HIGH" && instrumentIdentitiesMatch([provenance.instrument, provenance.ticker], calibration.instrumentIdentifier) === true;
      const calibrationTimeframeMatch = calibration.timeframeConfidence === "HIGH" && compatibleTimeframe(provenance.timeframe, calibration.timeframe);
      if (!identityMatch || !timeframeMatch || !compatiblePrice(provenance.currentPrice, raw.currentPrice)
        || !calibrationIdentityMatch || !calibrationTimeframeMatch || !compatiblePrice(provenance.currentPrice, calibration.currentPrice)) {
        return { expiresAt: Date.now() + REPLAY_TTL_MS, status: 422, payload: { error: "Liquidity Guard could not verify that this is the same primary chart." } };
      }
      if (raw.candlesReadable !== true || raw.priceScaleReadable !== true || raw.confidence === "LOW"
        || calibration.candlesReadable !== true || calibration.priceScaleReadable !== true || calibration.confidence === "LOW") {
        return { expiresAt: Date.now() + REPLAY_TTL_MS, status: 422, payload: { error: "Liquidity Guard needs clearer candles and at least two readable price-axis labels." } };
      }
      const normalizationDiagnostics: string[] = [];
      const independentGeometry = { ...raw, plotBounds: calibration.plotBounds, priceScaleAnchors: calibration.priceScaleAnchors };
      const liquidityShield = normalizePrecisionLiquidityShield(independentGeometry, provenance.currentPrice, normalizationDiagnostics);
      const rawShield = raw.liquidityShield && typeof raw.liquidityShield === "object"
        ? raw.liquidityShield as Record<string, unknown>
        : null;
      console.info("[pocket-bullseye] liquidity evidence", JSON.stringify({
        rawStatus: rawShield?.status ?? "missing",
        rawZones: Array.isArray(rawShield?.zones) ? rawShield.zones.length : 0,
        anchors: Array.isArray(calibration.priceScaleAnchors) ? calibration.priceScaleAnchors.length : 0,
        independentCalibration: true,
        normalizedStatus: liquidityShield.status,
        normalizedZones: liquidityShield.zones.length,
        rejectionReasons: [...new Set(normalizationDiagnostics)],
      }));
      const result = canonicalizePocketGeometry({
        plotBounds: calibration.plotBounds,
        priceScaleAnchors: calibration.priceScaleAnchors,
        liquidityShield,
        evidenceQuality: { chartReadability: "CLEAR", candlesReadable: true },
      }) as Record<string, unknown>;
      return { expiresAt: Date.now() + REPLAY_TTL_MS, status: 200, payload: { liquidity: result } };
    } catch (error) {
      const reason = classifyOpenAIFailure(error);
      const retryable = reason === "timeout" || reason === "provider_unavailable";
      const status = retryable ? 502 : reason === "rate_limited" ? 429 : reason === "quota_exhausted" ? 402 : 424;
      console.error("[pocket-bullseye] liquidity rescan failed", JSON.stringify({ reason, durationMs: Date.now() - startedAt }));
      return {
        expiresAt: Date.now(),
        status,
        payload: { error: retryable ? "Liquidity Guard could not complete this chart check. Please retry once." : "Liquidity Guard is temporarily unavailable. Your existing analysis is unchanged." },
      };
    }
  })();
  if (key) inFlight.set(key, work);
  try {
    const result = await work;
    if (key && result.status !== 502) completed.set(key, result);
    console.info("[pocket-bullseye] liquidity rescan complete", JSON.stringify({ status: result.status, durationMs: Date.now() - startedAt }));
    return NextResponse.json(result.payload, { status: result.status, headers: pocketBudgetHeaders(budget) });
  } finally {
    if (key && inFlight.get(key) === work) inFlight.delete(key);
  }
}
