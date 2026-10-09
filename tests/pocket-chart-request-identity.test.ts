import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createChartRequestEpoch } from "../app/pocket/chart-request-identity.ts";

test("an earlier FileReader completion cannot replace a newer chart", () => {
  const epoch = createChartRequestEpoch();
  const oldRead = epoch.begin();
  const newRead = epoch.begin();
  assert.equal(epoch.isCurrent(oldRead), false);
  assert.equal(epoch.isCurrent(newRead), true);
});

test("a response started for chart A cannot be applied after chart B is selected", () => {
  const epoch = createChartRequestEpoch();
  const chartA = epoch.snapshot();
  assert.equal(epoch.isCurrent(chartA), true);
  epoch.invalidate();
  assert.equal(epoch.isCurrent(chartA), false);
});

test("Pocket client guards FileReader and analysis responses by chart identity", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  assert.match(client, /primaryUploadEpoch\.current\.begin\(\)/);
  assert.match(client, /contextUploadEpoch\.current\.begin\(\)/);
  assert.match(client, /analysisEpoch\.current\.invalidate\(\)/);
  assert.match(client, /primaryUploadEpoch\.current\.isCurrent\(readToken\)/);
  assert.match(client, /contextUploadEpoch\.current\.isCurrent\(readToken\)/);
  assert.match(client, /analysisEpoch\.current\.isCurrent\(requestToken\)/);
  assert.match(client, /setPreflightStatus\("CHECKING"\)/);
  assert.match(client, /setChartConfirmation\(null\)/);
});

test("old preflight callbacks are cancelled after image replacement", async () => {
  const panel = await readFile(new URL("../app/pocket/ChartPreflightPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /controller\.abort\(\)/);
  assert.match(panel, /if \(!active\) return/);
});
