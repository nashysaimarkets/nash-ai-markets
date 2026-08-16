import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildEventMode } from "../app/lib/oracle/event-mode.ts";
import type { MarketEvent } from "../app/lib/market-data.ts";

const NOW = Date.parse("2026-08-16T12:00:00.000Z");

function eventIn(minutes: number, overrides: Partial<MarketEvent> = {}): MarketEvent {
  return {
    time: "Sun 16 Aug, 14:00 BST",
    name: "US CPI",
    risk: "HIGH",
    at: new Date(NOW + minutes * 60_000).toISOString(),
    ...overrides,
  };
}

function build(events: readonly MarketEvent[], overrides: Partial<Parameters<typeof buildEventMode>[0]> = {}) {
  return buildEventMode({
    events,
    now: NOW,
    verified: true,
    permissionLabel: "SELECTIVE",
    permissionTone: "caution",
    ...overrides,
  });
}

test("high-impact event inside two hours activates preparation mode", () => {
  const model = build([eventIn(60)]);
  assert.equal(model.available, true);
  assert.equal(model.mode, "active");
  assert.equal(model.modeLabel, "EVENT MODE ACTIVE");
  assert.equal(model.event?.countdownLabel, "1h 0m");
  assert.equal(model.event?.phaseLabel, "Preparation window");
  assert.equal(model.phases.find((phase) => phase.id === "prepare")?.state, "current");
  assert.equal(model.phases.find((phase) => phase.id === "release")?.state, "next");
  assert.match(model.methodology, /no extra provider request/i);
});

test("final fifteen minutes advances to release window without opening permission", () => {
  const model = build([eventIn(10)], { permissionLabel: "WAIT", permissionTone: "blocked" });
  assert.equal(model.event?.phaseLabel, "Release window approaching");
  assert.equal(model.phases.find((phase) => phase.id === "prepare")?.state, "complete");
  assert.equal(model.phases.find((phase) => phase.id === "release")?.state, "current");
  assert.equal(model.phases.find((phase) => phase.id === "verify")?.state, "locked");
  assert.equal(model.permission.label, "WAIT");
  assert.match(model.permission.guardrail, /observation-only/i);
});

test("example-only mode is explicit, blocked and deterministic", () => {
  const model = build([eventIn(60)], {
    verified: false,
    exampleOnly: true,
    permissionLabel: "OPEN",
    permissionTone: "open",
  });
  assert.equal(model.exampleOnly, true);
  assert.equal(model.event?.dataStatusLabel, "EXAMPLE ONLY · NOT LIVE");
  assert.equal(model.event?.impactLabel, "Example-only impact window");
  assert.equal(model.permission.label, "WAIT FOR VERIFIED CONTEXT");
  assert.equal(model.permission.tone, "blocked");
  assert.match(model.methodology, /makes no live request/i);
  assert.match(model.methodology, /cannot change decision permission/i);
});

test("unverified calendar context never masquerades as verified", () => {
  const model = build([eventIn(180)], {
    verified: false,
    permissionLabel: "OPEN",
    permissionTone: "open",
  });
  assert.equal(model.mode, "watch");
  assert.equal(model.event?.dataStatusLabel, "CALENDAR CONTEXT · VERIFICATION REQUIRED");
  assert.equal(model.permission.label, "WAIT FOR VERIFIED CONTEXT");
  assert.equal(model.permission.tone, "blocked");
});

test("missing, malformed and past events fail closed without an invented protocol", () => {
  const cases: readonly MarketEvent[][] = [
    [],
    [{ time: "TBC", name: "US CPI", risk: "HIGH" }],
    [eventIn(-30)],
  ];
  for (const events of cases) {
    const model = build(events);
    assert.equal(model.available, false);
    assert.equal(model.event, null);
    assert.deepEqual(model.phases, []);
    assert.equal(model.permission.label, "NO VERIFIED EVENT WINDOW");
    assert.match(model.methodology, /No event-specific state is inferred/i);
  }
});

test("following event windows use only supplied, chronological rows", () => {
  const model = build([
    eventIn(240, { name: "Consumer sentiment", risk: "MED" }),
    eventIn(60),
    eventIn(180, { name: "FOMC Press Conference" }),
  ]);
  assert.equal(model.event?.name, "US CPI");
  assert.deepEqual(model.followingEvents.map((event) => event.name), [
    "Fed Press Conference",
    "Consumer sentiment",
  ]);
});

test("Event Mode remains server-safe, accessible and integrated without a new feed", async () => {
  const [component, model, builder, dashboard, brief, dashboardPreview, briefPreview, css, handoff] = await Promise.all([
    readFile(new URL("../app/components/oracle/EventModePanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/oracle/event-mode.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/oracle/build-oracle-bundle.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/components/MarketCommandCentre.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/brief/components/MorningMarketBrief.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/marketing-preview/components/RealDashboardPreview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/marketing-preview/components/RealBriefPreview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/oracle/oracle.css", import.meta.url), "utf8"),
    readFile(new URL("../docs/PROJECT_BULLSEYE_HANDOFF.md", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(component, /["']use client["']/);
  assert.match(component, /aria-labelledby="event-mode-title"/);
  assert.match(component, /<ol className="oracleEventProtocol"/);
  assert.match(component, /<details className="oracleFollowingEvents"/);
  assert.match(component, /href="\/terminal#catalysts"/);
  assert.doesNotMatch(`${component}\n${model}`, /fetch\(|createClient|supabase|stripe/i);

  assert.match(builder, /events: input\.snapshot\.events/);
  assert.match(builder, /buildEventMode/);
  assert.match(dashboard, /<EventModePanel model=\{oracle\.eventMode\}/);
  assert.match(dashboard, /catalyst && !eventModeAvailable/);
  assert.match(brief, /<EventModePanel model=\{oracle\.eventMode\}/);
  assert.match(brief, /oracle\.eventMode\.available \? null : timeline\.length/);
  assert.match(dashboardPreview, /exampleOnly: true/);
  assert.match(briefPreview, /exampleOnly: true/);
  assert.match(css, /\.oracleEventProtocol\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:640px\)/);
  assert.match(handoff, /edit --path \/workspace\/sites\/nash-ai-markets-bullseye-staging/);
});
