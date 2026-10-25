import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAuthCompatibleFetch } from "./utils/supabase/auth-compatible-fetch.ts";
import { resolveSupabasePublicConfig } from "./utils/supabase/config.ts";

/**
 * Refresh Supabase auth cookies on each request so server components see
 * sessions established by the browser PKCE callback.
 */
export async function middleware(request: NextRequest) {
  // The native PKCE relay must not read/refresh a Safari session. The app
  // exchanges the code using its own pending verifier after the return.
  if (request.nextUrl.pathname === "/auth/native-return") return NextResponse.next();
  // Public candidate diagnostics must not read or refresh a customer's session.
  if (request.nextUrl.pathname === "/api/pocket/native-readiness") return NextResponse.next();
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { url, key } = resolveSupabasePublicConfig();
  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    global: {
      fetch: createAuthCompatibleFetch(key),
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
