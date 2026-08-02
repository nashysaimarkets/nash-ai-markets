import { NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server.ts";
import { checkOpenAIConnection } from "../../../lib/server/openai.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "cache-control": "no-store" };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ status: "authentication_required" }, { status: 401, headers: noStoreHeaders });
  }

  const health = await checkOpenAIConnection();
  return NextResponse.json(health, {
    status: health.status === "connected" ? 200 : 503,
    headers: noStoreHeaders,
  });
}
