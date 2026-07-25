import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("BrandLogo is enlarged and shared across member and terminal surfaces", async () => {
  const [logo, globals, terminal, shell, styles] = await Promise.all([
    read("../app/components/BrandLogo.tsx"),
    read("../app/globals.css"),
    read("../app/terminal/page.tsx"),
    read("../app/components/MemberShell.tsx"),
    read("../app/mission-control.css"),
  ]);
  assert.match(logo, /compact \? 64 : 325/);
  assert.match(logo, /compact \? 64 : 56/);
  assert.match(logo, /Project BULLSEYE/);
  assert.match(logo, /data-project="bullseye"/);
  assert.match(globals, /height:56px/);
  assert.match(terminal, /MemberShell/);
  assert.match(terminal, /BrandLogo/);
  assert.match(terminal, /terminalCanvasLogo/);
  assert.match(styles, /\.terminalCanvasLogo img\{height:72px/);
  assert.doesNotMatch(terminal, /ftBrand|NASH <b>AI<\/b> \/ BULLSEYE/);
  assert.match(shell, /BrandLogo authenticated/);
});

test("premium terminal instrument cards use verified sparklines and truthful age labels", async () => {
  const [customer, styles, wave, grid] = await Promise.all([
    read("../app/terminal/components/CustomerTerminal.tsx"),
    read("../app/mission-control.css"),
    read("../public/brand/market-wave.svg"),
    read("../public/brand/world-market-grid.svg"),
  ]);
  assert.match(styles, /premiumTerminal/);
  assert.match(styles, /ctInstrumentCard|ctInstrumentAge/);
  assert.match(wave, /linearGradient/);
  assert.match(grid, /pattern/);
  assert.match(customer, /MarketCommandHeader|MarketDirectionalGaugesPanel/);
});
