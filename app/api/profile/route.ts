import { NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server.ts";
import { rejectCrossOriginCoded } from "../../lib/server/same-origin.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = rejectCrossOriginCoded(request);
  if (blocked) return blocked;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  let displayName = "";
  try {
    const body = await request.json() as { displayName?: unknown };
    displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 });
  }
  if (displayName.length < 2 || displayName.length > 60 || /[\u0000-\u001f\u007f]/.test(displayName)) {
    return NextResponse.json({ ok: false, code: "INVALID_PROFILE" }, { status: 400 });
  }

  try {
    const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } });
    if (error) return NextResponse.json({ ok: false, code: "PROFILE_UNAVAILABLE" }, { status: 503 });
  } catch {
    return NextResponse.json({ ok: false, code: "PROFILE_UNAVAILABLE" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
