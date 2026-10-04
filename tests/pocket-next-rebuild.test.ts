import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Pocket Next is a standalone frontend and does not render legacy PocketBullseye", async () => {
  const page = await readFile(new URL("../app/pocket-next/page.tsx", import.meta.url), "utf8");
  assert.match(page, /import PocketNext from "\.\/PocketNext"/);
  assert.doesNotMatch(page, /PocketBullseye/);
});

test("Pocket Next uses a distinct warm institutional palette and workspace layout", async () => {
  const css = await readFile(new URL("../app/pocket-next/pocket-next.css", import.meta.url), "utf8");
  assert.match(css, /--pn-paper:#ede9df/);
  assert.match(css, /--pn-ink:#172232/);
  assert.match(css, /grid-template-columns:86px minmax\(0,1fr\) 340px/);
  assert.match(css, /grid-template-columns:repeat\(6,1fr\)/);
});

test("Pocket Next keeps the hardened analysis API as the engine", async () => {
  const client = await readFile(new URL("../app/pocket-next/PocketNext.tsx", import.meta.url), "utf8");
  assert.match(client, /fetch\("\/api\/pocket\/analyse"/);
  assert.match(client, /OPEN NO-CREDIT INTERFACE DEMO/);
  assert.match(client, /A second opinion/);
  assert.match(client, /pnChart/);
  assert.doesNotMatch(client, /psCommandDeck|psLaunchHero|psResultReveal/);
});
