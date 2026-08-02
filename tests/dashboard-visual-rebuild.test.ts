import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const centre = read("app/dashboard/components/MarketCommandCentre.tsx");
const tokens = read("app/visual-tokens.css");
const experience = read("app/dashboard-visual-experience.css");
const gamePlan = read("app/dashboard/components/TodaysGamePlanPanel.tsx");
const strip = read("app/dashboard/components/CommandStrip.tsx");
const bullBear = read("app/components/companion/BullBearMeter.tsx");

test("dashboard semantic colour tokens exist beyond a single green accent", () => {
  for (const token of ["--dash-positive", "--dash-info", "--dash-caution", "--dash-warning", "--dash-risk", "--dash-muted"]) {
    assert.match(tokens, new RegExp(token));
  }
});

test("the hero presents mission-control orientation and a customise control", () => {
  assert.match(centre, /MISSION CONTROL/);
  assert.match(centre, /Customise/);
  assert.match(centre, /dashWorkspacePanel/);
  assert.match(centre, /Sparkline/);
  assert.match(centre, /BULLSEYE READINESS/);
  assert.match(centre, /dashReadinessSignals/);
  assert.match(centre, /dashSectionRail/);
  assert.match(centre, /CompactConfidenceChange/);
  assert.match(centre, /vxAtmosphere-/);
  assert.match(centre, /dashPlanContinuity/);
});

test("final polish never lets the section rail cover scrolled content", () => {
  const centreCss = read("app/market-command-centre.css");
  assert.match(centreCss, /\.dashSectionRail\{position:relative/);
  assert.doesNotMatch(centreCss, /\.dashSectionRail\{position:sticky/);
});

test("workspace controls are no longer always mounted in the main flow", () => {
  assert.match(centre, /workspaceOpen \? <DashboardWorkspaceControls/);
  assert.doesNotMatch(centre, /<DashboardWorkspaceControls prefs=\{prefs\} onChange=\{persist\} \/>\s*\n\s*<section className="dashQuickActions"/);
});

test("market pulse and game plan use varied visual primitives", () => {
  assert.match(strip, /MARKET PULSE/);
  assert.match(strip, /MicroVisual/);
  assert.match(strip, /dashMicroRisk/);
  assert.match(strip, /dashMicroBias/);
  assert.match(strip, /dashMicroDirection/);
  assert.match(gamePlan, /ConfidenceRing/);
  assert.match(gamePlan, /RiskMeter/);
  assert.match(centre, /VisualLevelMap/);
});

test("snapshot-only feeds are never disguised as historical sparklines", () => {
  assert.match(strip, /if \(cell\.sparkline\?\.length\)/);
  assert.match(strip, /direction: \$\{cell\.tone\}/);
  assert.match(strip, /visual awaiting verified data/);
});

test("unavailable probability bars do not render a measured zero fill", () => {
  assert.match(bullBear, /is-awaiting/);
  assert.doesNotMatch(bullBear, /width: `\$\{model\.available \? side\.probability : 0\}%`/);
});

test("visual experience stylesheet is scoped to the command centre", () => {
  assert.match(experience, /\.dashCommandCentre/);
  assert.match(experience, /prefers-reduced-motion/);
  assert.match(read("app/globals.css"), /dashboard-visual-experience\.css/);
});

test("dashboard opens as a decision cockpit and keeps secondary reports on demand", () => {
  assert.match(centre, /DECISION COCKPIT/);
  assert.match(centre, /dashCockpitGrid/);
  assert.match(centre, /ON-DEMAND INTELLIGENCE/);
  assert.match(centre, /Market intelligence/);
  assert.match(centre, /Session planning/);
  assert.match(centre, /Review &amp; learning/);
  assert.doesNotMatch(centre, /renderOrder\.filter\(\(id\) => id !== "thirty-second"\)\.map/);
});

test("AI coach is a compact floating assistant rather than a content-width bar", () => {
  const centreCss = read("app/market-command-centre.css");
  assert.match(centreCss, /\.dashAiCoach\{\s*position:fixed/);
  assert.doesNotMatch(centreCss, /\.dashAiCoach\{[^}]*position:sticky/);
});
