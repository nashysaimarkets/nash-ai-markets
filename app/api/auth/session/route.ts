import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { resolveSupabasePublicConfig } from "../../../../utils/supabase/config";
import { createAuthCompatibleFetch } from "../../../../utils/supabase/auth-compatible-fetch";

type SessionPayload = {
  accessToken?: unknown;
  refreshToken?: unknown;
};

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let body: SessionPayload;
  try {
    body = await request.json() as SessionPayload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken : "";
  if (!accessToken || !refreshToken || accessToken.length > 8192 || refreshToken.length > 8192) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const { url, key } = resolveSupabasePublicConfig();
    if (!url || !key) {
      return NextResponse.json({ ok: false }, { status: 503 });
    }
    const cookieStore = await cookies();
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    // Write to the returned response, not the ambient Server Component cookie
    // store, whose write errors the shared client deliberately suppresses.
    const supabase = createServerClient(url, key, {
      global: { fetch: createAuthCompatibleFetch(key) },
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(items) {
          for (const { name, value, options } of items) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error || !data.session) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    // A successful token validation without a session cookie is not a login.
    if (!response.headers.has("set-cookie")) {
      return NextResponse.json({ ok: false }, { status: 503 });
    }
    return response;
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
