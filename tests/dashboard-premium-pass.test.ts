import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const centreCss = read("app/market-command-centre.css");
const tokens = read("app/visual-tokens.css");
const internals = read("app/components/companion/MarketInternalsPanel.tsx");

test("the shared geometry scale is defined once and reused, not redeclared", () => {
  for (const token of ["--radius-xs", "--radius-sm", "--radius-md", "--radius-lg", "--radius-pill"]) {
    assert.match(tokens, new RegExp(`${token}:`), `${token} should be defined in visual-tokens.css`);
  }
});

test("no dashboard radius sits off the shared scale", () => {
  // Every literal radius was snapped onto the token scale. 50% and inherit are
  // shape keywords rather than scale values, so they are allowed through.
  const literals = [...centreCss.matchAll(/border-radius:\s*([^;}]+)/g)]
    .map((match) => match[1].trim())
    .filter((value) => value !== "inherit" && value !== "50%")
    .filter((value) => !value.startsWith("var(--radius-"));
  assert.deepEqual(literals, [], `unexpected off-scale radii: ${literals.join(", ")}`);
});

test("hover motion is opt-in and fully withdrawn under reduced motion", () => {
  assert.match(centreCss, /@media \(prefers-reduced-motion:no-preference\)/);
  assert.match(centreCss, /@media \(prefers-reduced-motion:reduce\)/);
  const reduceBlocks = centreCss.split("@media (prefers-reduced-motion:reduce)").slice(1);
  const withdrawsTransform = reduceBlocks.some((block) => /transform:none/.test(block.slice(0, 900)));
  assert.ok(withdrawsTransform, "reduced motion must cancel hover translation");
});

test("hover elevation stays subtle rather than bouncing or scaling", () => {
  // Entrance keyframes legitimately travel further, so only hover rules are
  // measured here; those are the ones the user feels while scanning.
  const hoverRules = [...centreCss.matchAll(/:hover(?:,[^{]*)?\{([^}]*)\}/g)].map((m) => m[1]);
  const lifts = hoverRules
    .flatMap((rule) => [...rule.matchAll(/transform:translateY\((-?\d+)px\)/g)])
    .map((m) => Number(m[1]));
  assert.ok(lifts.length > 0, "expected at least one hover lift");
  assert.ok(
    lifts.every((value) => Math.abs(value) <= 2),
    `hover lift should stay within 2px, saw: ${lifts.join(", ")}`,
  );
  assert.doesNotMatch(centreCss, /\.dashCommandCentre[^{]*:hover\{[^}]*scale\(/);
});

test("dashboard controls share one visible focus ring", () => {
  assert.match(centreCss, /\.dashCommandCentre a:focus-visible[\s\S]{0,200}outline:2px solid/);
});

test("key figures use tabular numerals so columns align", () => {
  assert.match(centreCss, /font-variant-numeric:tabular-nums/);
  assert.match(centreCss, /\.dashCommandCentre \.dashHeroPrice/);
});

test("awaiting integrations are badged as planned rather than failed", () => {
  assert.match(internals, /Planned integration/);
  assert.match(centreCss, /\.dashPlannedBadge\{/);
  assert.doesNotMatch(internals, /error|failed|broken/i);
});

test("the inline concept hint is not stretched into a full-width control", () => {
  assert.match(centreCss, /\.oracleConceptHint\{[\s\S]{0,120}display:inline-flex/);
});
