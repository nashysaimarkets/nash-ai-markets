import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("loading route mirrors the empty terminal canvas", async () => {
  const source = await read("../app/terminal/loading.tsx");
  for (const className of ["customerTerminal", "ctWorkspace", "terminalEmptyCanvas"]) {
    assert.match(source, new RegExp(className));
  }
  assert.match(source, /aria-busy="true"/);
  assert.match(source, /aria-live="polite"/);
  assert.doesNotMatch(source, /tmMarketsSidebar|ctChartPrimary|ctHero|ctAssetGrid|ctTwoColumn/);
});

test("terminal controls provide names, state and modal focus management", async () => {
  const source = await read("../app/terminal/components/TerminalControls.tsx");
  assert.match(source, /aria-label="Toggle full screen"/);
  assert.match(source, /aria-label="Open keyboard help"/);
  assert.match(source, /aria-expanded=\{showHelp\}/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /closeButtonRef\.current\?\.focus\(\)/);
  assert.match(source, /previousFocus\?\.focus\(\)/);
  assert.match(source, /event\.key !== "Tab"/);
});

test("chart workspace is keyboard discoverable and described", async () => {
  const source = await read("../app/terminal/components/MarketChart.tsx");
  assert.match(source, /role="group" aria-label="Chart timeframe"/);
  assert.match(source, /aria-label=\{`Show \$\{option\} timeframe`\}/);
  assert.match(source, /role="img" tabIndex=\{0\}/);
  assert.match(source, /aria-describedby="market-chart-description"/);
  assert.match(source, /not live market data/);
});

test("premium polish supports MacBook, mobile, reduced motion and high contrast", async () => {
  const styles = await read("../app/mission-control.css");
  assert.match(styles, /max-width:1366px/);
  assert.match(styles, /marketChartCanvas,.marketChartState\{height:400px\}/);
  assert.match(styles, /max-width:640px/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /prefers-contrast:more/);
  assert.match(styles, /focus-visible/);
});

test("polish remains restrained and the terminal canvas stays clear", async () => {
  const [styles, page, canvas] = await Promise.all([
    read("../app/mission-control.css"),
    read("../app/terminal/page.tsx"),
    read("../app/components/MemberEmptyCanvas.tsx"),
  ]);
  assert.doesNotMatch(styles, /backdrop-filter/);
  assert.match(page, /MemberEmptyCanvas/);
  assert.match(canvas, /BrandLogo/);
  assert.match(canvas, /terminalEmptyCanvas/);
  assert.match(canvas, /terminalCanvasLogo/);
  assert.doesNotMatch(page, /DecisionEnginePanel|MarketDirectionalGaugesPanel|DashboardCandlestickChart|MarketsBrowser/);
});
