import { NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server.ts";
import {
  createJournalEntry,
  deleteJournalEntry,
  listJournalEntries,
  type JournalEntryInput,
} from "../../lib/server/trade-journal.ts";
import { loadPreviewClaims } from "../../terminal/lib/preview-access.ts";
import {
  createProgressiveAccess,
  resolveMembershipTier,
} from "../../terminal/lib/membership-entitlement.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTIONS = new Set(["long", "short", "neutral"]);
const INSTRUMENTS = new Set(["futures", "options"]);

function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function optionalString(value: unknown, max: number): string | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length > max) return undefined;
  return trimmed;
}

function optionalBool(value: unknown): boolean | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value !== "boolean") return undefined;
  return value;
}

function validateInput(body: Record<string, unknown>): JournalEntryInput | null {
  const tradedAt = typeof body.tradedAt === "string" ? body.tradedAt.trim() : "";
  const tradedMs = Date.parse(tradedAt);
  if (!tradedAt || !Number.isFinite(tradedMs)) return null;

  const instrumentClass = typeof body.instrumentClass === "string" ? body.instrumentClass : "";
  const direction = typeof body.direction === "string" ? body.direction : "";
  const underlying = typeof body.underlying === "string" ? body.underlying.trim() : "";
  if (!INSTRUMENTS.has(instrumentClass) || !DIRECTIONS.has(direction) || underlying.length < 1 || underlying.length > 32) {
    return null;
  }

  const entryPrice = optionalNumber(body.entryPrice);
  const stopPrice = optionalNumber(body.stopPrice);
  const targetPrice = optionalNumber(body.targetPrice);
  const exitPrice = optionalNumber(body.exitPrice);
  const pnl = optionalNumber(body.pnl);
  const bullseyeScore = optionalNumber(body.bullseyeScore);
  const positionSize = optionalString(body.positionSize, 64);
  const optionsStrategy = optionalString(body.optionsStrategy, 80);
  const expiry = optionalString(body.expiry, 32);
  const strikes = optionalString(body.strikes, 120);
  const plannedMaxRisk = optionalString(body.plannedMaxRisk, 120);
  const notes = optionalString(body.notes, 2000);
  const reason = optionalString(body.reason, 500);
  const emotion = optionalString(body.emotion, 64);
  const eventExposure = optionalString(body.eventExposure, 120);
  const lesson = optionalString(body.lesson, 500);
  const vixRegime = optionalString(body.vixRegime, 64);
  const followedPlan = optionalBool(body.followedPlan);
  const respectedConfirmation = optionalBool(body.respectedConfirmation);
  const respectedInvalidation = optionalBool(body.respectedInvalidation);

  if ([
    entryPrice, stopPrice, targetPrice, exitPrice, pnl, bullseyeScore, positionSize, optionsStrategy, expiry, strikes,
    plannedMaxRisk, notes, reason, emotion, eventExposure, lesson, vixRegime, followedPlan,
    respectedConfirmation, respectedInvalidation,
  ].includes(undefined)) {
    return null;
  }

  return {
    tradedAt: new Date(tradedMs).toISOString(),
    instrumentClass: instrumentClass as JournalEntryInput["instrumentClass"],
    underlying,
    direction: direction as JournalEntryInput["direction"],
    entryPrice: entryPrice ?? null,
    stopPrice: stopPrice ?? null,
    targetPrice: targetPrice ?? null,
    positionSize: positionSize ?? null,
    optionsStrategy: optionsStrategy ?? null,
    expiry: expiry ?? null,
    strikes: strikes ?? null,
    plannedMaxRisk: plannedMaxRisk ?? null,
    exitPrice: exitPrice ?? null,
    pnl: pnl ?? null,
    notes: notes ?? null,
    reason: reason ?? null,
    emotion: emotion ?? null,
    followedPlan: followedPlan ?? null,
    respectedConfirmation: respectedConfirmation ?? null,
    respectedInvalidation: respectedInvalidation ?? null,
    eventExposure: eventExposure ?? null,
    lesson: lesson ?? null,
    bullseyeScore: bullseyeScore ?? null,
    vixRegime: vixRegime ?? null,
  };
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}

async function journalAccess(identity: Awaited<ReturnType<typeof requireUser>>) {
  if (!identity.user?.email) return "forbidden" as const;
  const { data: membership, error } = await identity.supabase
    .from("memberships")
    .select("plan, status, current_period_end")
    .ilike("email", identity.user.email)
    .in("plan", ["free", "pro", "elite"])
    .maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(error));
  if (tier === "temporarily_unavailable") return "unavailable" as const;
  const preview = await loadPreviewClaims(identity.user.id);
  const access = createProgressiveAccess(tier, preview.claims);
  return access.features.journal ? "allowed" as const : "forbidden" as const;
}

function accessFailure(status: "forbidden" | "unavailable") {
  return status === "unavailable"
    ? NextResponse.json({ ok: false, message: "Membership access is temporarily unavailable." }, { status: 503 })
    : NextResponse.json({ ok: false, message: "Decision Journal requires NASH Membership." }, { status: 403 });
}

export async function GET(request: Request) {
  if (!sameOrigin(request) && request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const identity = await requireUser();
  if (!identity.user) return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 401 });
  const access = await journalAccess(identity);
  if (access !== "allowed") return accessFailure(access);

  const result = await listJournalEntries(identity.user.id);
  if (!result.available) {
    return NextResponse.json({
      ok: false,
      message: result.reason === "migration_pending"
        ? "The trade journal is being prepared and will be available shortly."
        : "Journal entries are temporarily unavailable.",
    }, { status: 503 });
  }
  return NextResponse.json({ ok: true, rows: result.rows });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const identity = await requireUser();
  if (!identity.user) return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 401 });
  const access = await journalAccess(identity);
  if (access !== "allowed") return accessFailure(access);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Please check the journal fields and try again." }, { status: 400 });
  }

  const input = validateInput(body);
  if (!input) {
    return NextResponse.json({ ok: false, message: "Please check the journal fields and try again." }, { status: 400 });
  }

  const result = await createJournalEntry(identity.user.id, input);
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      message: result.reason === "migration_pending"
        ? "The trade journal is being prepared and will be available shortly."
        : "Your journal entry could not be saved. Please try again.",
    }, { status: 503 });
  }
  return NextResponse.json({ ok: true, row: result.row });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const identity = await requireUser();
  if (!identity.user) return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 401 });
  const access = await journalAccess(identity);
  if (access !== "allowed") return accessFailure(access);

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id || id.length > 64) {
    return NextResponse.json({ ok: false, message: "Please check the journal fields and try again." }, { status: 400 });
  }

  const result = await deleteJournalEntry(identity.user.id, id);
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      message: result.reason === "migration_pending"
        ? "The trade journal is being prepared and will be available shortly."
        : "Your journal entry could not be deleted. Please try again.",
    }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
