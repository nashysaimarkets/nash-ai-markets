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
  const chartA = epoch.begin();
  assert.equal(epoch.isCurrent(chartA), true);
  epoch.invalidate();
  assert.equal(epoch.isCurrent(chartA), false);
});

test("Pocket client uses epochs to guard uploads and response application", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  assert.match(client, /primaryUploadEpoch\.current\s*\+\+/);
  assert.match(client, /contextUploadEpoch\.current\s*\+\+/);
  assert.match(client, /analysisEpoch\.current\s*\+\+/);
  assert.match(client, /if\s*\(.*primaryUploadEpoch\.current.*\)\s*return/);
  assert.match(client, /if\s*\(.*analysisEpoch\.current.*\)\s*return/);
  assert.match(client, /setPreflightStatus\("CHECKING"\)/);
  assert.match(client, /setChartConfirmation\(null\)/);
});
