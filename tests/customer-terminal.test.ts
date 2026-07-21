import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createUnavailableSnapshot } from "../app/lib/market-data.ts";
import { createCustomerSignals, instrumentInterpretation, scoreStance } from "../app/terminal/lib/customer-terminal.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("customer signal bands are deterministic and explicit", () => {
  assert.equal(scoreStance(60), "supportive");
  assert.equal(scoreStance(40), "restrictive");
  assert.equal(scoreStance(50), "balanced");
  assert.equal(scoreStance(80, false), "unavailable");
});

test("customer signals fail closed when the provider snapshot is unavailable", () => {
  const snapshot = createUnavailableSnapshot();
  const signals = createCustomerSignals(snapshot, analyzeMarketSnapshot(snapshot));
  assert.equal(signals.length, 4);
  assert.ok(signals.every((signal) => signal.stance === "unavailable" && signal.score === 0));
  assert.equal(instrumentInterpretation(undefined), "Awaiting a verified provider observation.");
});

test("customer terminal keeps diagnostics out of normal customer navigation", async () => {
  const [terminal, dashboard] = await Promise.all([read("../app/terminal/page.tsx"), read("../app/dashboard/page.tsx")]);
  assert.doesNotMatch(terminal, /LaunchDiagnosticsPanel|createLaunchDiagnostics|\/terminal\/diagnostics/);
  assert.doesNotMatch(dashboard, /href="\/terminal\/diagnostics"/);
});

test("customer terminal provides readable responsive presentation contracts", async () => {
  const styles = await read("../app/mission-control.css");
  assert.match(styles, /\.customerTerminal\{[^}]*font-size:18px/);
  assert.match(styles, /\.ctHero h1\{[^}]*clamp\(40px,6vw,56px\)/);
  assert.match(styles, /\.ctChartPrimary/);
  assert.match(styles, /@media\(max-width:600px\)/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /prefers-contrast:more/);
});

test("customer terminal places the verified chart ahead of secondary panels", async () => {
  const terminal = await read("../app/terminal/page.tsx");
  const chartAt = terminal.indexOf('className="ctChartPrimary"');
  const boardAt = terminal.indexOf("<CrossAssetBoard");
  assert.ok(chartAt > 0 && boardAt > chartAt);
  assert.doesNotMatch(terminal, /Previous comparison unavailable|<WhatChanged/);
  assert.doesNotMatch(terminal, /Bullseye provider diagnostics|LaunchDiagnosticsPanel/);
});
