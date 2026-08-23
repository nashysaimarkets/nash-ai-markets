/**
 * The Command Centre overflowed horizontally on every viewport below ~400px.
 * .marketCommandCentre is a grid, and grid items default to min-width:auto, so
 * the widest child's min-content sized the column track past the container's
 * fixed width and every section spilled off-screen. The audit harness never
 * caught it because it cannot authenticate, so only public routes were measured.
 *
 * These tests pin the structural rules that keep the layout inside the viewport.
 * Pixel verification lives in scripts/preview-screenshots.mjs, which renders the
 * real components and measures scrollWidth against clientWidth.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildCommandStrip } from "../app/dashboard/lib/command-strip.ts";
import type { DeskDecisionPresentation } from "../app/terminal/lib/desk-decision-presentation.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

/** Strips CSS comments so assertions cannot pass on commented-out rules. */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

test("command centre grid children may shrink below their min-content width", async () => {
  const css = withoutComments(await read("../app/market-command-centre.css"));
  assert.match(
    css,
    /\.marketCommandCentre\s*>\s*\*\s*\{[^}]*min-width\s*:\s*0/,
    "grid items need min-width:0 or one wide child widens the whole column track",
  );
});

test("section headers wrap instead of forcing a wider track", async () => {
  const centre = withoutComments(await read("../app/market-command-centre.css"));
  assert.match(
    centre,
    /\.dashDecisionSnap>header\{[^}]*flex-wrap\s*:\s*wrap/,
    "the posture header pairs a title with a pill and must wrap on narrow screens",
  );

  const oracle = withoutComments(await read("../app/components/oracle/oracle.css"));
  assert.match(
    oracle,
    /\.oracleThirty header[^{]*\{[^}]*flex-wrap\s*:\s*wrap/,
    "oracle panel headers must wrap on narrow screens",
  );
});

test("concept hints stay inside the cell that opens them", async () => {
  const oracle = withoutComments(await read("../app/components/oracle/oracle.css"));
  const rule = oracle.match(/\.oracleConceptHint>div\{[^}]*\}/)?.[0] ?? "";
  assert.match(rule, /max-width\s*:\s*min\(/, "hint width must be capped by its container");
  assert.match(rule, /overflow-wrap\s*:\s*anywhere/, "long terms must break rather than widen the grid");
});

const decision: DeskDecisionPresentation = {
  leanLabel: "Neutral",
  leanTone: "neutral",
  permissionLabel: "WAIT FOR CONFIRMATION",
  permissionTone: "blocked",
  confidenceLabel: "NOT ESTABLISHED",
  confidenceDetail: "Awaiting evidence",
  confidenceScore: null,
  riskLabel: "Elevated",
  why: "Incomplete confirmation",
  supporting: [],
  opposing: [],
  primaryRisk: "Confirmation evidence is incomplete",
  analysisAvailable: true,
};

function strip() {
  return buildCommandStrip({
    hero: {
      symbolLabel: "ES",
      price: "5050.00",
      netChange: "+1.25",
      percentChange: "+0.02%",
      direction: "up",
      sessionLabel: "PRE-MARKET",
      sessionDetail: "Preparing",
      delayedAgeLine: "Delayed · 15 min",
      priceSourceLabel: "Verified quote",
      rangePositionPct: 55,
      rangeLow: "5000",
      rangeHigh: "5100",
      rangeNote: null,
      deskHref: "/terminal",
    },
    decision,
    weather: [
      {
        id: "VIX",
        name: "VIX",
        value: "16.2",
        change: "-0.3",
        direction: "down",
        interpretation: "VIX lower",
        available: true,
      },
    ],
    session: {
      phase: "premarket",
      label: "Pre-market",
      detail: "Preparing",
      countdownLabel: "Opens in 01:20",
      countdownMs: 4_800_000,
      nowEt: "07:00 ET",
      nextEventLabel: "Cash open",
      source: "clock",
    },
    quotes: [],
    expectedMove: null,
  });
}

test("command strip separates unconfigured feeds from feeds awaiting a value", () => {
  const model = strip();

  // Instruments with no verified source at all.
  for (const id of ["SPY", "GOLD", "BTC", "breadth", "pc", "tick"]) {
    const cell = model.cells.find((item) => item.id === id);
    assert.ok(cell, `${id} must still be present in the model`);
    assert.equal(cell!.coverage, "unconfigured");
    assert.equal(cell!.available, false);
  }

  // A feed we do read but currently have no verified value for.
  assert.equal(model.cells.find((item) => item.id === "expected")?.coverage, "pending");
  assert.equal(model.cells.find((item) => item.id === "ES")?.coverage, "verified");
});

test("unconfigured instruments are disclosed but not rendered as empty tiles", async () => {
  const component = await read("../app/dashboard/components/CommandStrip.tsx");
  assert.match(component, /coverage !== "unconfigured"/, "grid must exclude unconfigured cells");
  assert.match(
    component,
    /Not on the verified dashboard feed/,
    "unconfigured instruments must still be disclosed to the customer",
  );
});

test("no command strip value is fabricated when coverage is missing", () => {
  for (const cell of strip().cells) {
    if (cell.coverage === "verified") continue;
    assert.equal(cell.value, "—", `${cell.id} must show an em dash rather than an estimate`);
  }
});
