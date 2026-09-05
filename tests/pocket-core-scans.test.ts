import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("liquidity pattern and macro outcomes stay visible before either result view", async () => {
  const [client, styles, page] = await Promise.all([
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/pocket-core-scans.css", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/page.tsx", import.meta.url), "utf8"),
  ]);
  const summary = client.indexOf("<CoreScanSummary");
  const resultChoice = client.indexOf('{resultView === "cinema" ? <MarketStory');
  assert.ok(summary > 0 && summary < resultChoice);
  assert.match(client, /LIQUIDITY GUARD/);
  assert.match(client, /PATTERN SCAN/);
  assert.match(client, /MACRO CHECK/);
  assert.match(client, /NO CLEAR LIQUIDITY CLUSTER/);
  assert.match(client, /NO CLEAN PATTERN VERIFIED/);
  assert.match(client, /future events cannot be read from a chart picture/);
  assert.match(client, /setCommandDeckMode\(mode\); openResultReport\("bullseye-tools"\)/);
  assert.match(client, /openResultReport\("bullseye-events"\)/);
  assert.match(styles, /@media\(max-width:520px\)/);
  assert.match(page, /pocket-core-scans\.css/);
});
