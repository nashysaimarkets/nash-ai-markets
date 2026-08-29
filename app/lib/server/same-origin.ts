import { NextResponse } from "next/server";

/** True when the request Origin or Referer header matches the URL origin of this server. */
export function isSameOrigin(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return origin === requestOrigin;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === requestOrigin;
    } catch {
      return false;
    }
  }
  return true;
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
