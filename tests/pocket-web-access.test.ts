import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { getPocketWebAccessStatus } from "../app/pocket/web-subscription.ts";
import { checkPocketScanAccess } from "../app/lib/server/pocket-scan-access.ts";
import { buildEmailRedirectTo, buildPostAuthRedirect, defaultPostAuthPath, isAllowedAuthOrigin, safeAuthNextPath } from "../app/lib/auth/safe-auth-redirect.ts";

test("Pocket origin and destinations survive sign-in without accepting lookalike hosts or redirects", () => {
  const origin = "https://pocket.nashaimarkets.com";
  assert.equal(isAllowedAuthOrigin(origin), true);
  assert.equal(defaultPostAuthPath(origin), "/pocket");
  assert.equal(buildEmailRedirectTo(origin), `${origin}/auth/callback`);
  assert.equal(buildPostAuthRedirect(origin), `${origin}/pocket`);
  assert.equal(buildPostAuthRedirect(origin, "/pocket/founding"), `${origin}/pocket/founding`);
  for (const host of ["https://pocket.nashaimarkets.com.evil.invalid", "https://evilpocket.nashaimarkets.com"]) assert.equal(isAllowedAuthOrigin(host), false);
  for (const path of ["//evil.invalid/pocket", "/pocket-evil", "/pocket/\\evil.invalid"]) assert.equal(safeAuthNextPath(path, "/pocket"), "/pocket");
});

test("subscription status handler returns private no-store denials and never accepts submitted account IDs", async () => {
  const source = await readFile(new URL("../app/api/pocket/subscription-access/route.ts", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("export async function GET")).replace("export async function", "async function");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const status of [200, 401, 403, 503]) {
    let received: Request | undefined;
    const get = await new AsyncFunction("requirePocketSubscriptionAccess", stripTypeScriptTypes(body) + "\nreturn GET;")(async (request: Request) => { received = request; return status === 200 ? null : Response.json({ code: "denied" }, { status }); });
    const request = new Request("https://pocket.nashaimarkets.com/api/pocket/subscription-access?user_id=untrusted");
    const response = await get(request) as Response;
    assert.equal(received, request);
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), status === 200 ? { entitled: true } : { code: "denied", entitled: false });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match(response.headers.get("vary") ?? "", /Cookie/);
  }
});

test("web client distinguishes current subscription, expiry, malformed evidence and outages", async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, body, expected] of [[200, { entitled: true }, true], [200, { entitled: false }, false], [401, {}, false], [403, {}, false]] as const) {
      globalThis.fetch = async (url, init) => {
        assert.equal(url, "/api/pocket/subscription-access");
        assert.equal(init?.cache, "no-store");
        assert.equal(init?.credentials, "same-origin");
        return Response.json(body, { status });
      };
      assert.equal(await getPocketWebAccessStatus(), expected);
    }
    for (const [status, body] of [[503, {}], [200, { entitled: "true" }], [200, {}], [200, null]] as const) {
      globalThis.fetch = async () => Response.json(body, { status });
      await assert.rejects(getPocketWebAccessStatus());
    }
  } finally { globalThis.fetch = original; }
});

test("independent signed Apple access survives web outage while free-use and unverified Apple never bypass it", async () => {
  const user = { id: "11111111-1111-4111-8111-111111111111", email: "member@example.invalid", email_confirmed_at: "2026-01-01" };
  for (const verified of [true, false]) {
    let freeCalls = 0;
    const result = await checkPocketScanAccess({ authenticate: async () => user, hasSubscription: async () => { throw new Error("web ledger unavailable"); }, hasAppleSubscription: async () => verified, hasFirstFreeAccess: async () => { freeCalls++; return true; } });
    assert.equal(result?.status ?? null, verified ? null : 503);
    assert.equal(freeCalls, 0);
  }
});

test("status lookup excludes internal benchmark and first-free admission", async () => {
  const source = await readFile(new URL("../app/lib/server/pocket-scan-access.ts", import.meta.url), "utf8");
  const status = source.slice(source.indexOf("export async function requirePocketSubscriptionAccess"), source.indexOf("function pocketAccessDependencies"));
  assert.match(status, /pocketAccessDependencies\(request, false\)/);
  assert.doesNotMatch(status, /pocketTestProviderProject/);
  const login = await readFile(new URL("../app/pocket/login/page.tsx", import.meta.url), "utf8");
  assert.match(login, /existingAccountOnly/);
  assert.match(login, /defaultNext="\/pocket"/);
});
