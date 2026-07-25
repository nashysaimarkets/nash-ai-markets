import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createUnavailableSnapshot } from "../app/lib/market-data.ts";
import { createCustomerSignals, instrumentInterpretation, scoreStance } from "../app/terminal/lib/customer-terminal.ts";
import { formatCustomerParticipationWarnings } from "../app/terminal/lib/customer-warnings.ts";

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
  assert.match(styles, /\.terminalEmptyCanvas/);
  assert.match(styles, /\.terminalCanvasLogo/);
  assert.match(styles, /@media\(max-width:600px\)/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /prefers-contrast:more/);
});

test("customer terminal is a cleared brand canvas for rebuild", async () => {
  const terminal = await read("../app/terminal/page.tsx");
  assert.match(terminal, /MemberShell/);
  assert.match(terminal, /BrandLogo/);
  assert.match(terminal, /terminalCanvasLogo/);
  assert.match(terminal, /resolveMembershipTier/);
  assert.match(terminal, /createProgressiveAccess/);
  assert.match(terminal, /loadPreviewClaims/);
  assert.doesNotMatch(terminal, /MarketDirectionalGaugesPanel|DashboardCandlestickChart|CrossAssetCandleGallery|LockedPremiumCard|TerminalControls/);
  assert.doesNotMatch(terminal, /DecisionIntelligencePanel|StructureLevelsPanel|AskBullseye|MarketDeskSignalsPanel/);
  assert.doesNotMatch(terminal, /CrossAssetBoard|TodaysMarketPlan|Upcoming catalysts|EventWindowEmpty|KeyMarketInformation/);
});

test("customer participation warnings hide internal schema field names", () => {
  const warnings = formatCustomerParticipationWarnings(
    ["CRITICAL_INPUT_MISSING"],
    [
      { code: "AGED_DATA", field: "dataAgeMs" },
      { code: "DELAYED_DATA", field: "dataStatus" },
      { code: "PROVIDER_DEGRADED", field: "providerStatus" },
      { code: "MISSING_EVIDENCE", field: "trend" },
    ],
    ["EVENT_NEAR"],
  );
  assert.deepEqual(warnings, [
    "Required market inputs are incomplete",
    "Market data is delayed beyond the live window",
    "Market data is delayed",
    "The market data connection is degraded",
    "Missing evidence: trend",
    "A high-impact event is nearby",
  ]);
  assert.ok(warnings.every((item) => !/dataAgeMs|dataStatus|providerStatus/.test(item)));
});
