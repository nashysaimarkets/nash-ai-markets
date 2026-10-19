import assert from "node:assert/strict";
import test from "node:test";
import { POCKET_SITES_ORIGIN, verifyPocketSitesDeployment } from "../scripts/verify-pocket-sites-deployment.ts";

const SHA = "cbd518df6d1fa51c4879081eae9743ec28dae4d3";

function mockSite(overrides: Record<string, Response> = {}) {
  const seen: string[] = [];
  const requester: typeof fetch = async (input, init) => {
    const url = String(input);
    const path = new URL(url).pathname;
    assert.equal(new URL(url).origin, POCKET_SITES_ORIGIN);
    assert.equal(init?.method, "GET");
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.redirect, "manual");
    assert.equal(init?.cache, "no-store");
    seen.push(path);
    return overrides[path] ?? ({
      "/api/pocket/build-manifest": Response.json({ revision: SHA }, { headers: { "cache-control": "no-store" } }),
      "/api/pocket/subscription-access": Response.json({ code: "POCKET_LOGIN_REQUIRED", entitled: false }, {
        status: 401, headers: { "cache-control": "private, no-store", vary: "Cookie, x-pocket-apple-transaction" },
      }),
      "/pocket/login": new Response("<html><h1>Sign in to Pocket Bullseye</h1></html>", {
        status: 200, headers: { "content-type": "text/html; charset=utf-8" },
      }),
    } as Record<string, Response>)[path]!;
  };
  return { requester, seen };
}

test("Sites release probe verifies exact revision, unsigned denial and dedicated Pocket sign-in without paid traffic", async () => {
  const { requester, seen } = mockSite();
  const result = await verifyPocketSitesDeployment(SHA, requester);
  assert.deepEqual(result, { verified: true, revision: SHA, unsignedAccessDenied: true, pocketSignIn: true });
  assert.deepEqual(seen, ["/api/pocket/build-manifest", "/api/pocket/subscription-access", "/pocket/login"]);
});

test("bad source revision fails before any network or paid request", async () => {
  const { requester, seen } = mockSite();
  await assert.rejects(verifyPocketSitesDeployment("staging", requester), /immutable 40-character Git revision/);
  assert.deepEqual(seen, []);
  const wrong = mockSite({
    "/api/pocket/build-manifest": Response.json({ revision: "f".repeat(40) }, { headers: { "cache-control": "no-store" } }),
  });
  await assert.rejects(verifyPocketSitesDeployment(SHA, wrong.requester), /build revision differs/);
  assert.deepEqual(wrong.seen, ["/api/pocket/build-manifest"]);
});

test("an open, missing, cached or unavailable paid access guard cannot pass cutover", async () => {
  for (const response of [
    Response.json({ entitled: true }, { headers: { "cache-control": "private, no-store", vary: "Cookie" } }),
    Response.json({ entitled: false }, { status: 404, headers: { "cache-control": "private, no-store", vary: "Cookie" } }),
    Response.json({ entitled: false }, { status: 503, headers: { "cache-control": "private, no-store", vary: "Cookie" } }),
    Response.json({ code: "POCKET_LOGIN_REQUIRED", entitled: false }, { status: 401 }),
    Response.json({ code: "POCKET_LOGIN_REQUIRED", entitled: true }, { status: 401, headers: { "cache-control": "private, no-store", vary: "Cookie" } }),
  ]) {
    const { requester, seen } = mockSite({ "/api/pocket/subscription-access": response });
    await assert.rejects(verifyPocketSitesDeployment(SHA, requester), /unsigned subscription-access/);
    assert.equal(seen.length, 2);
  }
});

test("incorrect login, redirects and absent manifest must fail closed", async () => {
  const badLogin = mockSite({
    "/pocket/login": new Response("<html>Your market preparation starts here.</html>", {
      headers: { "content-type": "text/html" },
    }),
  });
  await assert.rejects(verifyPocketSitesDeployment(SHA, badLogin.requester), /wrong membership login/);
  const redirect = mockSite({
    "/pocket/login": new Response(null, { status: 302, headers: { location: "/login" } }),
  });
  await assert.rejects(verifyPocketSitesDeployment(SHA, redirect.requester), /redirected unexpectedly/);
  const missing = mockSite({ "/api/pocket/build-manifest": new Response("missing", { status: 404 }) });
  await assert.rejects(verifyPocketSitesDeployment(SHA, missing.requester), /build manifest missing/);
});
