import { NextResponse } from "next/server";
import { normalizeWaitlistSubmission } from "../../lib/launch-onboarding.ts";
import { insertWaitlistSubmission } from "../../lib/server/waitlist.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = { "cache-control": "no-store" };

export async function POST(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const suppliedOrigin = request.headers.get("origin");
  if (suppliedOrigin !== requestOrigin) {
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

  const insertResult = await insertWaitlistSubmission(submission);
  if (insertResult === "unavailable") {
    return NextResponse.json({ ok: false, code: "WAITLIST_UNAVAILABLE" }, { status: 503, headers: responseHeaders });
  }

  return NextResponse.json({ ok: true }, { headers: responseHeaders });
}
