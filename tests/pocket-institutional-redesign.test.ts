import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("institutional design system loads last in Pocket", async () => {
  const page = await readFile(new URL("../app/pocket/page.tsx", import.meta.url), "utf8");
  const professional = page.indexOf('import "./pocket-professional.css";');
  const institutional = page.indexOf('import "./pocket-institutional.css";');
  assert.ok(professional >= 0);
  assert.ok(institutional > professional);
});

test("Pocket primary result path is evidence-first, not cinematic-first", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  assert.match(client, /useState<"cinema" \| "report">\("report"\)/);
  assert.doesNotMatch(client, /aria-label="Choose result view"/);
  assert.doesNotMatch(client, /resultView === "cinema" \? <MarketStory/);
  assert.match(client, /POCKET BULLSEYE · ANALYSIS WORKSPACE/);
});

test("institutional launch removes decorative signal theatre", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  assert.match(client, /Evidence before/);
  assert.match(client, /PRE-TRADE ANALYSIS/);
  assert.doesNotMatch(client, /psLaunchSignals/);
  assert.doesNotMatch(client, /SCANNING<br \/>FOR CLARITY/);
});

test("institutional stylesheet keeps chart depth restrained", async () => {
  const styles = await readFile(new URL("../app/pocket/pocket-institutional.css", import.meta.url), "utf8");
  assert.match(styles, /translateZ\(3px\) scale\(1\.002\)/);
  assert.match(styles, /Remove legacy theatre everywhere/);
  assert.match(styles, /--pb-bg:#080b0f/);
});
