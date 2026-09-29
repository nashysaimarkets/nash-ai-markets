import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { campaignAttribution } from "../../../lib/marketing-attribution.ts";
import { createAdminClient } from "../../../../utils/supabase/admin.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "pb_campaign_visitor";

function sameOrigin(request: Request): boolean {
  try {
    return request.headers.get("origin") === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function visitorKey(request: Request): { value: string; created: boolean } {
  const cookie = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE}=`))
    ?.slice(VISITOR_COOKIE.length + 1);
  return cookie && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cookie)
    ? { value: cookie, created: false }
    : { value: randomUUID(), created: true };
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ recorded: false }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ recorded: false }, { status: 400 });
  }
  const values = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const attribution = campaignAttribution({
    utm_source: values.source,
    utm_medium: values.medium,
    utm_campaign: values.campaign,
  });
  const visitor = visitorKey(request);
  try {
    const { error } = await createAdminClient().from("marketing_visits").upsert({
      visitor_key: visitor.value,
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign,
      landing_path: "/pocket/founding",
    }, { onConflict: "visitor_key,source,campaign", ignoreDuplicates: true });
    if (error) throw error;
  } catch (error) {
    console.error("Campaign visit was not recorded", {
      category: "campaign_attribution_failure",
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ recorded: false }, { status: 503 });
  }
  const response = NextResponse.json({ recorded: true });
  if (visitor.created) response.cookies.set(VISITOR_COOKIE, visitor.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return response;
}
