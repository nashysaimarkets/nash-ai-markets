import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";

const componentPath = new URL("../app/pocket/PocketBullseye.tsx", import.meta.url);
const pagePath = new URL("../app/pocket/page.tsx", import.meta.url);
const cssPath = new URL("../app/pocket/pocket-precision-overhaul.css", import.meta.url);

test("written results expose a precision-first evidence summary before the verdict", async () => {
  const source = await readFile(componentPath, "utf8");
  const truthStrip = source.indexOf("<ResultTruthStrip analysis={analysis} />");
  const verdict = source.indexOf('<header id="bullseye-verdict"');

  assert.ok(truthStrip > 0);
  assert.ok(verdict > truthStrip);
  assert.match(source, /value: priceVerified \? analysis\.currentPrice : "NOT VERIFIED"/);
  assert.match(source, /Unverified fields are never replaced with estimates/);
  assert.match(source, /data-verified=\{fact\.verified\}/);
});

test("mobile report rail reaches every decision-critical section", async () => {
  const source = await readFile(componentPath, "utf8");
  for (const target of ["#bullseye-verdict", "#bullseye-tools", "#bullseye-levels", "#bullseye-events", "#bullseye-evidence", "#bullseye-ask", "#bullseye-feedback"]) {
    assert.ok(source.includes(`href="${target}"`), `missing report destination ${target}`);
  }
  assert.ok(source.indexOf('href="#bullseye-levels"') < source.indexOf('href="#bullseye-events"'));
});

test("precision presentation layer is last and retired concepts no longer ship CSS", async () => {
  const page = await readFile(pagePath, "utf8");
  assert.ok(page.indexOf('import "./pocket-precision-overhaul.css"') > page.indexOf('import "./pocket-liquidity-guard.css"'));
  assert.doesNotMatch(page, /pocket-lock-on\.css|pocket-command-arena\.css|pocket-bubble-lab\.css/);

  for (const file of ["pocket-lock-on.css", "pocket-command-arena.css", "pocket-bubble-lab.css"]) {
    await assert.rejects(access(new URL(`../app/pocket/${file}`, import.meta.url)));
  }
});

test("overhaul preserves readable controls, focus visibility and reduced motion", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /font-size: max\(\.83rem, 13px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
