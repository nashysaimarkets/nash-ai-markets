import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const centre = read("app/dashboard/components/MarketCommandCentre.tsx");
const internals = read("app/components/companion/MarketInternalsPanel.tsx");
const awaiting = read("app/dashboard/components/AwaitingDataNote.tsx");
const centreCss = read("app/market-command-centre.css");

test("no internal or developer-facing wording is shown to customers", () => {
  assert.doesNotMatch(centre, /ready for injection/i);
  assert.doesNotMatch(internals, /Polished unavailable states/i);
});

test("the video centre empty state stays truthful and routes to the written brief", () => {
  // The empty state now lives in DashboardVideoCentre, which shows both daily
  // slots and still routes to the written brief. The centre itself only mounts it.
  assert.match(centre, /DashboardVideoCentre/);
  const videoCentre = read("app/dashboard/components/DashboardVideoCentre.tsx");
  assert.match(videoCentre, /Not published yet/);
  assert.match(videoCentre, /Morning Brief/);
  assert.doesNotMatch(videoCentre, /placeholder video/i);
});

test("market weather states freshness once per section rather than once per card", () => {
  assert.match(centre, /dashWeatherFreshness/);
  // The per-card repetition of the same freshness sentence is gone.
  assert.doesNotMatch(centre, /<small>Delayed · verified · \{hero\.delayedAgeLine\}<\/small>/);
});

test("the hero freshness label does not restate the freshness value", () => {
  assert.match(centre, /<strong>Data freshness<\/strong>/);
  assert.doesNotMatch(centre, /<strong>Delayed market data<\/strong>/);
});

test("the shared unavailable note keeps status, reason and optional depth", () => {
  for (const field of ["statusLabel", "reason", "explanation", "whyItMatters", "sourceLine"]) {
    assert.match(awaiting, new RegExp(field), `AwaitingDataNote should support ${field}`);
  }
  assert.match(awaiting, /role="status"/);
});

test("unavailable states are never rendered as zero or fabricated values", () => {
  assert.doesNotMatch(awaiting, /\b0\b\s*%/);
  assert.match(internals, /unavailable is never shown as zero/i);
});

test("market internals groups its metrics compactly and keeps every future integration point", () => {
  assert.match(internals, /is-compact/);
  assert.match(internals, /cards\.map/);
  assert.match(internals, /companionWhy/);
  // Six identical "Unavailable" badges no longer headline each card.
  assert.doesNotMatch(internals, /<strong>\{card\.status\}<\/strong>/);
});

test("dashboard cards respect the readable type floor and stay overflow-safe", () => {
  assert.match(centreCss, /\.dashAwaitingStatus\{[^}]*var\(--type-floor\)/);
  assert.match(centreCss, /\.dashCommandCell\{[^}]*min-width:0/);
  assert.match(centreCss, /\.dashCommandCell strong\{[^}]*overflow-wrap:anywhere/);
});

test("the shared unavailable disclosure is keyboard reachable with a visible focus ring", () => {
  assert.match(centreCss, /\.dashAwaitingWhy>summary:focus-visible\{[^}]*outline/);
});
