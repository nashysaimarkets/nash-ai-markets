import { NextResponse } from "next/server";
import { normalizeWaitlistSubmission } from "../../lib/launch-onboarding.ts";
import { insertWaitlistSubmission, logWaitlistFailure } from "../../lib/server/waitlist.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = { "cache-control": "no-store" };

export async function POST(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const suppliedOrigin = request.headers.get("origin");
  if (suppliedOrigin !== requestOrigin) {
    logWaitlistFailure("origin-validation");
    return NextResponse.json({ ok: false, code: "INVALID_ORIGIN" }, { status: 403, headers: responseHeaders });
  }

  let submission = null;
  try {
    submission = normalizeWaitlistSubmission(await request.json());
  } catch (error) {
    logWaitlistFailure("request-json", error);
    return NextResponse.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400, headers: responseHeaders });
  }
  if (!submission) {
    logWaitlistFailure("request-validation");
    return NextResponse.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400, headers: responseHeaders });
  }

  const insertResult = await insertWaitlistSubmission(submission);
  if (insertResult === "unavailable") {
    return NextResponse.json({ ok: false, code: "WAITLIST_UNAVAILABLE" }, { status: 503, headers: responseHeaders });
  }

  return NextResponse.json({ ok: true }, { headers: responseHeaders });
}
