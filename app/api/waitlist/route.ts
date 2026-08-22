import { NextResponse } from "next/server";
import { createAdminClient } from "../../../utils/supabase/admin.ts";
import { normalizeWaitlistSubmission } from "../../lib/launch-onboarding.ts";
import { isSameOrigin } from "../../lib/server/same-origin.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = { "cache-control": "no-store" };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, code: "INVALID_ORIGIN" }, { status: 403, headers: responseHeaders });
  }

  let submission = null;
  try {
    submission = normalizeWaitlistSubmission(await request.json());
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400, headers: responseHeaders });
  }
  if (!submission) {
    return NextResponse.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400, headers: responseHeaders });
  }

  try {
    const waitlist = createAdminClient().from("launch_waitlist");
    const { error } = submission.source === "homepage" || submission.source === "pocket-founding"
      ? await waitlist.upsert({ ...submission, updated_at: new Date().toISOString() }, { onConflict: "email" })
      : await waitlist.insert(submission);
    if (error && error.code !== "23505") {
      return NextResponse.json({ ok: false, code: "WAITLIST_UNAVAILABLE" }, { status: 503, headers: responseHeaders });
    }
  } catch {
    return NextResponse.json({ ok: false, code: "WAITLIST_UNAVAILABLE" }, { status: 503, headers: responseHeaders });
  }

  return NextResponse.json({ ok: true }, { headers: responseHeaders });
}
