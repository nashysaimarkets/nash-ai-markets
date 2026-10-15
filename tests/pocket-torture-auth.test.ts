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

test("billed benchmark requires one explicitly selected labelled case", async () => {
  const route = await readFile(new URL("../app/api/pocket/torture/route.ts", import.meta.url), "utf8");
  const paidGuard = route.indexOf("if (!mayRunLiveTorture(");
  const select = route.indexOf("if (!requested) return NextResponse.json(");
  const analysis = route.indexOf("await analyse(req)");
  assert.ok(paidGuard >= 0 && select > paidGuard && analysis > select,
    "one-case gate must run after authorization and before any billable calls");
  assert.match(route, /Live benchmark requires one named case/);
});

test("live benchmark records end-to-end duration for successful and failed cases", async () => {
  const route = await readFile(new URL("../app/api/pocket/torture/route.ts", import.meta.url), "utf8");
  const runner = await readFile(new URL("../scripts/run-pocket-image-torture.ts", import.meta.url), "utf8");
  for (const source of [route, runner]) {
    assert.match(source, /performance\.now\(\)/);
    assert.match(source, /durationMs/);
  }
  assert.match(route, /observations\.push\(\{id:sample\.id/);
});

test("one-case preview never claims the six-case benchmark is complete", async () => {
  const route = await readFile(new URL("../app/api/pocket/torture/route.ts", import.meta.url), "utf8");
  assert.match(route, /summarizeTortureMeasurements\(TORTURE_CASES\.map\(sample\s*=>\s*sample\.id\),measuredCaseIds,metrics\)/);
  assert.match(route, /caseMetrics:\s*scoredCase\.metrics/);
});

test("the protected workflow never fires all six billable scans in one dispatch", async () => {
  const workflow = await readFile(new URL("../.github/workflows/bullseye-image-torture.yml", import.meta.url), "utf8");
  const runner = await readFile(new URL("../scripts/run-pocket-image-torture.ts", import.meta.url), "utf8");
  assert.match(workflow, /case_id:/);
  assert.match(workflow, /POCKET_TORTURE_CASE:\s*\$\{\{\s*inputs\.case_id\s*\}\}/);
  assert.match(runner, /process\.env\.POCKET_TORTURE_CASE/);
  assert.match(runner, /TORTURE_CASES\.filter\(/);
  assert.doesNotMatch(runner, /for\s*\(const sample of TORTURE_CASES\)/);
  assert.match(runner, /caseMetrics:\s*scoredCase\.metrics/);
  // Prove that the case validation appears before any call to the live analyse route.
  assert.ok(runner.indexOf("POCKET_TORTURE_CASE") < runner.indexOf("await POST(req)"));
});
