import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { mayRunLiveTorture } from "../app/api/pocket/torture/authorization.ts";

const secret = "pocket-qa-test-secret-0123456789-abcdef";
const request = (token?: string) =>
  new Request("https://preview.example/api/pocket/torture?run=1",
    { headers: token ? { "x-pocket-torture-token": token } : {} });

test("live torture denies missing explicit enablement, secret or request token", () => {
  assert.equal(mayRunLiveTorture(request(), { enabled: "true", token: secret }), false);
  assert.equal(mayRunLiveTorture(request(secret), { token: secret }), false);
  assert.equal(mayRunLiveTorture(request(secret), { enabled: "false", token: secret }), false);
  assert.equal(mayRunLiveTorture(request(secret), { enabled: "true" }), false);
  assert.equal(mayRunLiveTorture(request("tiny"), { enabled: "true", token: "tiny" }), false);
});

test("live torture permits only an exact long token when deliberately enabled", () => {
  assert.equal(mayRunLiveTorture(request(secret), { enabled: "true", token: secret }), true);
  assert.equal(mayRunLiveTorture(request(secret + "x"), { enabled: "true", token: secret }), false);
  assert.equal(mayRunLiveTorture(request(secret.slice(0, -1)), { enabled: "true", token: secret }), false);
  assert.equal(mayRunLiveTorture(request("wrong-" + secret), { enabled: "true", token: secret }), false);
});

test("preview route enforces authorization before invoking a billed analysis", async () => {
  const route = await readFile(new URL("../app/api/pocket/torture/route.ts", import.meta.url), "utf8");
  const raster = route.indexOf('if(params.get("raster")==="1")');
  const guard = route.indexOf("if (!mayRunLiveTorture(");
  const billed = route.indexOf("await analyse(req)");
  assert.ok(raster >= 0, "no-provider raster path must be preserved");
  assert.ok(guard > raster, "paid path must be gated independently of raster path");
  assert.ok(billed > guard, "paid analysis must follow authorization");
  assert.match(route, /POCKET_TORTURE_LIVE_ENABLED/);
  assert.match(route, /POCKET_TORTURE_LIVE_TOKEN/);
  assert.match(route, /status:403/);
});
