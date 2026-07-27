/**
 * Operator-only YouTube OAuth redirect scaffold.
 *
 * Keeps YouTube Data API consent completely separate from customer
 * Supabase / magic-link / Stripe auth. Does not set session cookies.
 *
 * Local CLI (`tools/youtube-upload`) usually listens on :8787 itself.
 * This route supports a future production/operator redirect URI:
 *   https://www.nashaimarkets.com/api/youtube/oauth/callback
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        flow: "youtube_operator_oauth",
        error,
        note: "YouTube upload OAuth failed. This is unrelated to member login.",
      },
      { status: 400, headers: noStore },
    );
  }

  if (!code) {
    return NextResponse.json(
      {
        ok: false,
        flow: "youtube_operator_oauth",
        error: "missing_code",
        hint: "Expected ?code= from Google OAuth redirect. Prefer tools/youtube-upload npm run auth for local operator consent.",
      },
      { status: 400, headers: noStore },
    );
  }

  // Do not exchange the code here yet — exchange happens in the operator CLI /
  // a future gated operator handler that holds GOOGLE_CLIENT_SECRET server-side.
  // Returning the code in HTML would leak it via Referer; show a short confirmation only.
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>YouTube OAuth</title></head>
<body style="font-family:system-ui;padding:2rem;background:#0b0f14;color:#e8eef6">
  <h1>YouTube operator authorization received</h1>
  <p>Project BULLSEYE video automation callback scaffold.</p>
  <p>This page does <strong>not</strong> sign you into NASH AI Markets member accounts.</p>
  <p>Complete token exchange with <code>tools/youtube-upload</code> (<code>npm run auth</code>) or a future gated operator endpoint.</p>
  ${state ? `<p>State present: yes</p>` : ""}
  <p>Authorization code received (not displayed). Close this tab.</p>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      ...noStore,
      "content-type": "text/html; charset=utf-8",
    },
  });
}
