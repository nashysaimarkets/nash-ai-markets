import { NextResponse } from "next/server";

/** True when the request Origin header matches the URL origin of this server. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/**
 * Reject cross-origin mutating requests with a fixed opaque body.
 * Returns null when the request is same-origin and may proceed.
 */
export function rejectCrossOrigin(request: Request): NextResponse | null {
  if (isSameOrigin(request)) return null;
  return NextResponse.json({ ok: false }, { status: 403 });
}

/**
 * Same check with a structured error code for commercial / onboarding routes.
 */
export function rejectCrossOriginCoded(request: Request): NextResponse | null {
  if (isSameOrigin(request)) return null;
  return NextResponse.json({ ok: false, code: "INVALID_ORIGIN" }, { status: 403 });
}
