import { NextResponse } from "next/server";
import { campaignAttribution } from "../../../lib/marketing-attribution.ts";
import { isPocketFunnelEvent } from "../../../lib/marketing-funnel.ts";
import { recordPocketGrowthEvent } from "../../../lib/server/pocket-growth.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEGACY_VISITOR_COOKIE = "pb_campaign_visitor";

function sameOrigin(request: Request): boolean {
  try {
    return request.headers.get("origin") === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function jsonResponse(request: Request, status: number, recorded: boolean) {
  const response = NextResponse.json({ recorded }, { status });
  response.cookies.set(LEGACY_VISITOR_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ recorded: false }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, 400, false);
  }
  const values = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const attribution = campaignAttribution({
    utm_source: values.source,
    utm_medium: values.medium,
    utm_campaign: values.campaign,
  });
  const requestedEvents = Array.isArray(values.events) ? values.events.slice(0, 6) : [values.event];
  const events = [...new Set(requestedEvents.filter(isPocketFunnelEvent))];
  if (!events.length) return jsonResponse(request, 400, false);

  let recorded = true;
  for (const event of events) {
    if (!await recordPocketGrowthEvent(event, attribution)) recorded = false;
  }
  return jsonResponse(request, recorded ? 200 : 503, recorded);
}
