import { NextResponse } from "next/server";
import { createOpenAIClient } from "../../../lib/server/openai";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../lib/server/bounded-json-body";
import { pocketBudgetHeaders, takePocketBudget } from "../../../lib/server/pocket-request-budget";
import { levelLabRejectionMessage, validateLevelLabPrimaryProvenance, validateLevelLabScan } from "../level-lab-validation.ts";
import { rejectCrossOrigin } from "../../../lib/server/same-origin";
import { createHash } from "node:crypto";
import { pocketAIEnabled, pocketAIUsageRecord, pocketRequestId, pocketRequestIdentity, recordPocketAIUsage, type PocketAIUsageRecord } from "../../../lib/server/pocket-ai-commercial-guard";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_DATA_URL_LENGTH = 3_800_000;
const MAX_REQUEST_BYTES = MAX_DATA_URL_LENGTH + 32_768;
const LEVEL_LAB_PROVIDER_TIMEOUT_MS = 48_000;
const LEVEL_LAB_REPLAY_TTL_MS = 2 * 60_000;
const LEVEL_LAB_REPLAY_MAX_ENTRIES = 64;
type CachedLevelLabResult = { expiresAt: number; status: number; payload: Record<string, unknown> };
type LevelLabWorkResult = CachedLevelLabResult & { outcome: "held" | "complete" | "failed"; reason?: string; errorName?: string };
const completedLevelLabRequests = new Map<string, CachedLevelLabResult>();
const inFlightLevelLabRequests = new Map<string, Promise<LevelLabWorkResult>>();

function correlationId(request: Request) {
  const value = request.headers.get("x-pocket-request-id")?.trim() ?? "";
  return /^[a-zA-Z0-9_-]{8,80}$/.test(value)
    ? `req_${createHash("sha256").update(value).digest("hex").slice(0, 16)}`
    : "untracked";
}

function replayKey(requestId: string, image: string, precisionImage: string, primaryProvenance: unknown) {
  if (requestId === "untracked") return null;
  return createHash("sha256")
    .update(requestId).update("\0")
    .update(image).update("\0")
    .update(precisionImage).update("\0")
    .update(JSON.stringify(primaryProvenance))
    .digest("hex");
}

function pruneCompletedRequests(now: number) {
  for (const [key, result] of completedLevelLabRequests) {
    if (result.expiresAt <= now) completedLevelLabRequests.delete(key);
  }
}

function rememberCompletedRequest(key: string, result: CachedLevelLabResult) {
  pruneCompletedRequests(Date.now());
  while (completedLevelLabRequests.size >= LEVEL_LAB_REPLAY_MAX_ENTRIES) {
    const oldest = completedLevelLabRequests.keys().next().value as string | undefined;
    if (!oldest) break;
    completedLevelLabRequests.delete(oldest);
  }
  completedLevelLabRequests.set(key, result);
  const expiryTimer = setTimeout(() => {
    if (completedLevelLabRequests.get(key) === result) completedLevelLabRequests.delete(key);
  }, Math.max(1, result.expiresAt - Date.now()));
  expiryTimer.unref?.();
}

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
  const startedAt = Date.now();
  const requestId = correlationId(request);
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  if (!pocketAIEnabled()) return NextResponse.json({ code: "AI_DISABLED", error: "AI tools are paused by the service owner. No provider request was sent." }, { status: 503 });
  const identityHash = pocketRequestIdentity(request);
  const telemetryRequestId = pocketRequestId();
  const usageRecords: PocketAIUsageRecord[] = [];
  let image = "";
  let precisionImage = "";
  let rawPrimaryProvenance: unknown = null;
  try {
    const payload = await readBoundedJsonBody(request, MAX_REQUEST_BYTES) as { image?: unknown; precisionImage?: unknown; primaryProvenance?: unknown };
    image = typeof payload.image === "string" ? payload.image : "";
    precisionImage = typeof payload.precisionImage === "string" ? payload.precisionImage : "";
    rawPrimaryProvenance = payload.primaryProvenance;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "The Level Lab request is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid chart upload." }, { status: 400 });
  }
  const valid = (value: string) => /^data:image\/(jpeg|png|webp);base64,/.test(value) && value.length <= MAX_DATA_URL_LENGTH;
  if (!valid(image) || (precisionImage && !valid(precisionImage))) return NextResponse.json({ error: "The prepared Level Lab chart is not a valid, safely sized JPEG, PNG or WebP image." }, { status: 400 });
  const primaryProvenance = validateLevelLabPrimaryProvenance(rawPrimaryProvenance);
  if (!primaryProvenance) return NextResponse.json({ error: levelLabRejectionMessage("PRIMARY_PROVENANCE_UNVERIFIED") }, { status: 409 });
  pruneCompletedRequests(startedAt);
  const completedKey = replayKey(requestId, image, precisionImage, primaryProvenance);
  const replay = completedKey ? completedLevelLabRequests.get(completedKey) : null;
  if (replay && replay.expiresAt > startedAt) {
    console.info("[pocket-bullseye] level lab replay", JSON.stringify({ requestId, status: replay.status, durationMs: Date.now() - startedAt }));
    return NextResponse.json(replay.payload, {
      status: replay.status,
      headers: { "cache-control": "no-store", "x-pocket-request-id": requestId, "x-pocket-idempotent-replay": "1" },
    });
  }
  const inFlight = completedKey ? inFlightLevelLabRequests.get(completedKey) : null;
  if (inFlight) {
    const joined = await inFlight;
    console.info("[pocket-bullseye] level lab in-flight replay", JSON.stringify({ requestId, status: joined.status, durationMs: Date.now() - startedAt }));
    return NextResponse.json(joined.payload, {
      status: joined.status,
      headers: { "cache-control": "no-store", "x-pocket-request-id": requestId, "x-pocket-idempotent-replay": "in-flight" },
    });
  }
  const budget = takePocketBudget(request, "levels");
  if (!budget.allowed) return NextResponse.json({ error: "The level scanner needs a short reset." }, { status: 429, headers: pocketBudgetHeaders(budget) });
  const client = createOpenAIClient(undefined, LEVEL_LAB_PROVIDER_TIMEOUT_MS);
  if (!client) return NextResponse.json({ error: "AI level scanning is not connected in this environment." }, { status: 503 });
  console.info("[pocket-bullseye] level lab start", JSON.stringify({
    requestId,
    imageChars: image.length,
    hasPrecisionImage: Boolean(precisionImage),
  }));
  // Shared work must outlive a single WKWebView transport connection. A retry
  // with the same id can join this bounded provider call even if the first
  // response channel was dropped by iOS.
  const providerController = new AbortController();
  const providerTimer = setTimeout(() => providerController.abort(new Error("level_lab_timeout")), LEVEL_LAB_PROVIDER_TIMEOUT_MS);
  providerTimer.unref?.();
  const providerWork = (async (): Promise<LevelLabWorkResult> => {
    try {
      const model = process.env.OPENAI_POCKET_ANNOTATION_MODEL?.trim() || process.env.OPENAI_POCKET_SUPPORT_MODEL?.trim() || "gpt-5.6-luna";
      const response = await client.responses.create({
        model,
        reasoning: { effort: "low" }, store: false,
        instructions: [
          "You are Pocket Bullseye Level Lab. Analyse support and resistance only. Do not produce or change a verdict, pattern, scenario, score, direction, plan or risk assessment.",
          "Read instrumentIdentifier exactly as visibly printed on this Level Lab chart. Use UNKNOWN with instrumentConfidence UNKNOWN when hidden. Never copy the expected identity from the prompt unless it is independently visible in the screenshot.",
          "candlesReadable is true only when the reaction candle bodies and wicks are discernible. priceScaleReadable is true only when multiple consistent axis labels are clearly legible.",
          "Use only visible candle reactions. Return full-image percentage coordinates. plotBounds encloses the candle plot only.",
          "Read 3-4 clearly printed price-axis labels where possible. Exact numeric prices require at least two widely separated readable scale labels that form a consistent linear scale.",
        "Support and resistance lines span plotBounds left to right. Prefer one strong level on each side of current price, but if only one side is visible return that exact side and leave the missing side absent. Never use phone chrome, order tickets, footer values or the current-price guide as a structural level.",
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
      }, { signal: providerController.signal, timeout: LEVEL_LAB_PROVIDER_TIMEOUT_MS });
      const usage = pocketAIUsageRecord("level_lab", model, response);
      if (usage) usageRecords.push(usage);
      const output = response.output_text?.trim();
      if (!output) throw new Error("The level scan returned no result.");
      const validation = validateLevelLabScan(JSON.parse(output), primaryProvenance);
      if (!validation.ok) {
        return {
          expiresAt: Date.now() + LEVEL_LAB_REPLAY_TTL_MS,
          status: 422,
          payload: { error: levelLabRejectionMessage(validation.reason) },
          outcome: "held",
          reason: validation.reason,
        };
      }
      return {
        expiresAt: Date.now() + LEVEL_LAB_REPLAY_TTL_MS,
        status: 200,
        payload: { levels: validation.levels },
        outcome: "complete",
      };
    } catch (error) {
      return {
        expiresAt: Date.now(),
        status: 502,
        payload: { error: "The independent level scan could not complete. Please retry with a clearer price scale." },
        outcome: "failed",
        errorName: error instanceof Error ? error.name : "unknown",
      };
    } finally {
      clearTimeout(providerTimer);
    }
  })();
  if (completedKey) inFlightLevelLabRequests.set(completedKey, providerWork);
  try {
    const result = await providerWork;
    if (completedKey && result.status !== 502) rememberCompletedRequest(completedKey, result);
    if (result.outcome === "failed") {
      console.error("[pocket-bullseye] independent level scan failed", JSON.stringify({ requestId, error: result.errorName, durationMs: Date.now() - startedAt }));
    } else {
      console.info(`[pocket-bullseye] level lab ${result.outcome}`, JSON.stringify({ requestId, status: result.status, ...(result.reason ? { reason: result.reason } : {}), durationMs: Date.now() - startedAt }));
    }
    await recordPocketAIUsage(identityHash, telemetryRequestId, false, usageRecords, result.outcome === "failed" ? "failed" : "success");
    return NextResponse.json(result.payload, {
      status: result.status,
      headers: { ...pocketBudgetHeaders(budget), "x-pocket-request-id": requestId },
    });
  } finally {
    if (completedKey && inFlightLevelLabRequests.get(completedKey) === providerWork) inFlightLevelLabRequests.delete(completedKey);
  }
}
