import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load<T extends Record<string, unknown>>(path: string, modules: Record<string, unknown>): T {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", js)((id: string) => {
    assert.ok(id in modules, `Unexpected dependency: ${id}`);
    return modules[id];
  }, exports);
  return exports as T;
}

test("callback server passes runtime public credentials without requiring build-time values", () => {
  const config = { url: "https://runtime-fixture.supabase.co", key: "sb_publishable_fixture" };
  const page = load<{ dynamic: string; default: () => { props: unknown } }>("../app/auth/callback/page.tsx", {
    "./AuthCallbackClient": { default: "callback" },
    "../../../utils/supabase/config": { resolveSupabasePublicConfig: () => config },
    "react/jsx-runtime": { jsx: (type: unknown, props: unknown) => ({ type, props }) },
  });
  assert.equal(page.dynamic, "force-dynamic");
  assert.deepEqual(page.default().props, { supabaseUrl: config.url, supabasePublishableKey: config.key });
});

test("callback exchanges the code using runtime settings then persists the server session", async () => {
  let completion: (() => void) | undefined;
  let settings: unknown;
  const redirects: string[] = [];
  const calls: string[] = [];
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  Object.assign(globalThis, {
    window: { location: { origin: "https://pocket.nashaimarkets.com", search: "?code=fixture-code", hash: "", pathname: "/auth/callback", replace: (url: string) => { redirects.push(url); completion?.(); } }, history: { replaceState: () => {} } },
    document: { cookie: "" },
    fetch: async (url: string, init: RequestInit) => { calls.push(url); assert.equal(init.credentials, "same-origin"); return Response.json({ ok: true }); },
  });
  try {
    const client = load<{ default: (props: { supabaseUrl: string; supabasePublishableKey: string }) => unknown }>("../app/auth/callback/AuthCallbackClient.tsx", {
      react: { useEffect: (effect: () => void) => effect() },
      "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
      "../../../utils/supabase/client": { createClient: (override: unknown) => { settings = override; return { auth: { exchangeCodeForSession: async (code: string) => { assert.equal(code, "fixture-code"); return { data: { session: { access_token: "fixture-access", refresh_token: "fixture-refresh" } }, error: null }; } } }; } },
      "../../lib/auth/safe-auth-redirect": { AUTH_NEXT_COOKIE: "auth_next", defaultPostAuthPath: () => "/pocket", safeAuthNextPath: (_: unknown, fallback: string) => fallback },
    });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("callback did not finish")), 1000);
      completion = () => { clearTimeout(timeout); resolve(); };
      client.default({ supabaseUrl: "https://runtime-fixture.supabase.co", supabasePublishableKey: "sb_publishable_fixture" });
    });
    assert.deepEqual(settings, { url: "https://runtime-fixture.supabase.co", key: "sb_publishable_fixture" });
    assert.deepEqual(calls, ["/api/auth/session"]);
    assert.deepEqual(redirects, ["/pocket"]);
  } finally {
    Object.assign(globalThis, { window: previousWindow, document: previousDocument, fetch: previousFetch });
  }
});
