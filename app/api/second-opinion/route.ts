import { NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server.ts";
import { rejectCrossOrigin } from "../../lib/server/same-origin.ts";
import { isOwnerOnlyStagingRequest } from "../../lib/server/staging-owner-preview.ts";
import { buildProtectedPlanCheck, generateSecondOpinion, type SecondOpinionInput } from "../../lib/server/second-opinion.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 1_450_000;
const MAX_IMAGE_BYTES = 1_000_000;
const USER_DAILY_LIMIT = 3;
const PILOT_DAILY_LIMIT = 20;
const ALLOWED_TIMEFRAMES = new Set(["1m", "5m", "15m", "1h", "4h", "daily"]);
const ALLOWED_DIRECTIONS = new Set(["long", "short", "neutral"]);
const ALLOWED_IMAGE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;

type Counter = { day: string; total: number; users: Map<string, number> };
const counter: Counter = { day: "", total: 0, users: new Map() };

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function resetCounterIfNeeded() {
  const today = dayKey();
  if (counter.day === today) return;
  counter.day = today;
  counter.total = 0;
  counter.users.clear();
}

function hasCapacity(userId: string) {
  resetCounterIfNeeded();
  return counter.total < PILOT_DAILY_LIMIT && (counter.users.get(userId) ?? 0) < USER_DAILY_LIMIT;
}

function countUsage(userId: string) {
  counter.total += 1;
  counter.users.set(userId, (counter.users.get(userId) ?? 0) + 1);
}

function optionalString(value: unknown, max: number): string | null | undefined {
  if (value == null || value === "") return "";
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : undefined;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value == null || value === "") return null;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseInput(body: Record<string, unknown>): SecondOpinionInput | null {
  if (body.privacyConfirmed !== true) return null;
  const market = optionalString(body.market, 32);
  const timeframe = typeof body.timeframe === "string" ? body.timeframe : "";
  const direction = typeof body.direction === "string" ? body.direction : "";
  const currentPrice = optionalNumber(body.currentPrice);
  const entry = optionalNumber(body.entry);
  const stop = optionalNumber(body.stop);
  const target = optionalNumber(body.target);
  const stake = optionalString(body.stake, 64);
  const emotion = optionalString(body.emotion, 48);
  const thesis = optionalString(body.thesis, 500);
  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
  const imageMatch = imageDataUrl.match(ALLOWED_IMAGE);
  const estimatedImageBytes = imageMatch ? Math.floor((imageMatch[2].length * 3) / 4) : Number.POSITIVE_INFINITY;
  if (market === undefined || (timeframe !== "" && !ALLOWED_TIMEFRAMES.has(timeframe)) || !ALLOWED_DIRECTIONS.has(direction)
    || [currentPrice, entry, stop, target, stake, emotion, thesis].includes(undefined)
    || !imageMatch || estimatedImageBytes > MAX_IMAGE_BYTES) return null;
  return {
    market: market ?? "",
    timeframe,
    direction: direction as SecondOpinionInput["direction"],
    currentPrice: currentPrice ?? null,
    entry: entry ?? null,
    stop: stop ?? null,
    target: target ?? null,
    stake: stake ?? "",
    emotion: emotion ?? "",
    thesis: thesis ?? "",
    imageDataUrl,
  };
}

const statusMessage: Record<Exclude<Awaited<ReturnType<typeof generateSecondOpinion>>["status"], "generated">, string> = {
  not_configured: "The private analysis pilot is not enabled yet.",
  quota_exhausted: "The protected AI budget has been reached. No analysis was generated.",
  rate_limited: "The private analysis service is busy. Please wait before trying again.",
  timeout: "The chart review timed out. Do not treat this as confirmation of a trade.",
  unavailable: "The private analysis service is temporarily unavailable.",
  invalid_response: "The review did not pass Bullseye safety checks, so it was withheld.",
};

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declaredLength) || declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ ok: false, message: "The chart request is too large." }, { status: 413 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerPreview = isOwnerOnlyStagingRequest(request.headers);
  if (!user && !ownerPreview) {
    return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ ok: false, message: "The chart request is too large." }, { status: 413 });
    }
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "The chart request could not be read." }, { status: 400 });
  }
  const input = parseInput(body);
  if (!input) return NextResponse.json({ ok: false, message: "Check the chart, privacy confirmation and plan fields." }, { status: 400 });
  if (process.env.SECOND_OPINION_PRIVATE_PILOT !== "enabled") {
    return NextResponse.json(
      { ok: true, opinion: buildProtectedPlanCheck(input), mode: "plan-only" },
      { headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } },
    );
  }
  const usageIdentity = user?.id ?? "owner-only-staging-preview";
  if (!hasCapacity(usageIdentity)) {
    return NextResponse.json({ ok: false, message: "Today’s protected pilot allowance has been reached." }, { status: 429 });
  }
  countUsage(usageIdentity);
  const result = await generateSecondOpinion(input);
  if (result.status !== "generated") {
    return NextResponse.json({ ok: false, message: statusMessage[result.status] }, { status: result.status === "rate_limited" || result.status === "quota_exhausted" ? 429 : 503 });
  }
  return NextResponse.json(
    { ok: true, opinion: result.content },
    { headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } },
  );
}
