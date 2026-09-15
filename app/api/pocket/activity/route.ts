import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { normaliseGrowthPayload } from "../../../lib/pocket-growth.ts";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../lib/server/bounded-json-body.ts";
import { createAdminClient } from "../../../../utils/supabase/admin.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let rateSalt: string | undefined;
const budget = new Map<string, { expires: number; count: number }>();
function allowed(request: Request) {
  // Workers allow random generation during a request, not at module startup.
  rateSalt ??= randomUUID();
  const now = Date.now();
  for (const [key, value] of budget) if (value.expires <= now) budget.delete(key);
  const key = createHash("sha256").update(`${rateSalt}:${request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"}`).digest("hex");
  const entry = budget.get(key);
  if (entry) { entry.count += 1; return entry.count <= 60; }
  if (budget.size >= 2000) return false;
  budget.set(key, { expires: now + 60_000, count: 1 });
  return true;
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ recorded: false }, { status: 403 });
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return new Response(null, { status: 204 });
  if (!allowed(request)) return NextResponse.json({ recorded: false }, { status: 429 });
  try {
    const event = normaliseGrowthPayload(await readBoundedJsonBody(request, 2048));
    if (!event) return NextResponse.json({ recorded: false }, { status: 400 });
    const { error } = await createAdminClient().rpc("record_pocket_growth_event", {
      p_event: event.event, p_platform: event.platform, p_source: event.source, p_campaign: event.campaign,
      p_flow: event.flow, p_is_test: event.is_test, p_duration_ms: event.duration_ms,
    });
    if (error) throw error;
    return NextResponse.json({ recorded: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ recorded: false }, { status: 413 });
    if (error instanceof SyntaxError) return NextResponse.json({ recorded: false }, { status: 400 });
    console.error("[pocket-activity] aggregate recording unavailable");
    return NextResponse.json({ recorded: false }, { status: 503 });
  }
}
