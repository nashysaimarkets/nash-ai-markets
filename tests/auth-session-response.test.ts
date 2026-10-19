import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

async function sessionHandler(options: { invalid?: boolean; cookieFailure?: boolean; noCookies?: boolean } = {}) {
  const source = await readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8");
  const body = source.replace(/^import .*;\n/gm, "").replace("export async function POST", "async function POST");
  const outgoing: string[] = [];
  const responseFactory = {
    json(value: unknown, init?: ResponseInit) {
      const response = Response.json(value, init);
      return Object.assign(response, { cookies: {
        set(name: string, value: string, settings: { path?: string; secure?: boolean } = {}) {
          if (options.cookieFailure) throw new Error("response cookie unavailable");
          const cookie = `${name}=${value}; Path=${settings.path ?? "/"}${settings.secure ? "; Secure" : ""}`;
          response.headers.append("Set-Cookie", cookie);
          outgoing.push(cookie);
        },
      } });
    },
  };
  const sessionResult = { data: { session: options.invalid ? null : { access_token: "test-access" } }, error: options.invalid ? new Error("invalid") : null };
  const oldClient = async () => ({ auth: { setSession: async () => sessionResult } });
  const ssrClient = (_url: string, _key: string, config: { cookies: { setAll: (items: unknown[]) => void } }) => ({ auth: {
    setSession: async () => {
      if (!options.invalid && !options.noCookies) config.cookies.setAll([
        { name: "sb-fixture-auth-token.0", value: "test-part-a", options: { path: "/", secure: true } },
        { name: "sb-fixture-auth-token.1", value: "test-part-b", options: { path: "/", secure: true } },
      ]);
      return sessionResult;
    },
  } });
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const handler = await new AsyncFunction("NextResponse", "createClient", "createServerClient", "cookies", "resolveSupabasePublicConfig", "createAuthCompatibleFetch",
    stripTypeScriptTypes(body) + "\nreturn POST;")(
      responseFactory, oldClient, ssrClient,
      async () => ({ getAll: () => [], set: () => { throw new Error("ambient cookie writes unavailable"); } }),
      () => ({ url: "https://fixture.supabase.co", key: "fixture-public" }), () => fetch,
    );
  return { handler, outgoing };
}

function request(body: unknown = { accessToken: "test-access", refreshToken: "test-refresh" }, origin = "https://pocket.nashaimarkets.com") {
  return new Request("https://pocket.nashaimarkets.com/api/auth/session", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

test("session success carries every cookie on its actual response even when ambient cookie writes cannot work", async () => {
  const { handler } = await sessionHandler();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.match(response.headers.getSetCookie()[0], /Path=\/; Secure/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("session failures cannot report success or leak session material", async () => {
  for (const options of [{ invalid: true }, { cookieFailure: true }, { noCookies: true }]) {
    const { handler } = await sessionHandler(options);
    const response = await handler(request());
    assert.ok(response.status >= 400);
    assert.equal(response.headers.getSetCookie().length, 0);
    assert.doesNotMatch(await response.text(), /test-access|test-refresh|test-part/);
  }
});

test("session bridge rejects foreign origins and malformed token payloads", async () => {
  const { handler } = await sessionHandler();
  assert.equal((await handler(request(undefined, "https://untrusted.example"))).status, 403);
  assert.equal((await handler(request({ accessToken: "test-access" }))).status, 400);
});

test("real Supabase SSR cookies survive a Vinext response and authenticate the next request", async () => {
  const { createServerClient } = await import("@supabase/ssr");
  const { NextResponse } = await import("vinext/shims/server");
  const source = await readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8");
  const body = source.replace(/^import .*;\n/gm, "").replace("export async function POST", "async function POST");
  const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "qa@example.invalid", email_confirmed_at: "2026-10-19T00:00:00Z", created_at: "2026-10-19T00:00:00Z", app_metadata: {}, user_metadata: {}, identities: [] };
  // Offline provider fixture only: no real account, token or network request.
  const token = [Buffer.from('{"alg":"HS256"}').toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"), Buffer.from("offline-signature").toString("base64url")].join(".");
  let providerChecks = 0;
  const providerFetch: typeof fetch = async () => { providerChecks += 1; return Response.json(user); };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const handler = await new AsyncFunction("NextResponse", "createServerClient", "cookies", "resolveSupabasePublicConfig", "createAuthCompatibleFetch", stripTypeScriptTypes(body) + "\nreturn POST;")(
    NextResponse, createServerClient, async () => ({ getAll: () => [] }),
    () => ({ url: "https://fixture.supabase.co", key: "fixture-public" }), () => providerFetch,
  );
  const response = await handler(request({ accessToken: token, refreshToken: "offline-fixture-refresh" }));
  assert.equal(response.status, 200);
  const cookieHeaders = response.headers.getSetCookie();
  assert.ok(cookieHeaders.length > 0);
  const jar = cookieHeaders.map((header: string) => {
    const pair = header.split(";")[0];
    const split = pair.indexOf("=");
    return { name: pair.slice(0, split), value: decodeURIComponent(pair.slice(split + 1)) };
  });
  const nextClient = createServerClient("https://fixture.supabase.co", "fixture-public", {
    global: { fetch: providerFetch }, cookies: { getAll: () => jar, setAll: () => {} },
  });
  const { data, error } = await nextClient.auth.getUser();
  assert.equal(error, null);
  assert.equal(data.user?.id, user.id);
  assert.ok(providerChecks >= 2);
});
