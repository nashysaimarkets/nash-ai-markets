import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MARKET_CATALOG,
  MARKET_GROUPS,
  allMarketInstruments,
  catalogCountsByGroup,
  coverageLabel,
  getMarketInstrument,
} from "../app/lib/markets/market-catalog.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("market catalog exposes the eight Markets groupings", () => {
  assert.deepEqual(
    MARKET_CATALOG.map((group) => group.id),
    [...MARKET_GROUPS],
  );
  assert.deepEqual(
    MARKET_CATALOG.map((group) => group.label),
    ["Indices", "FX", "Cryptocurrency", "Shares", "Commodities", "Bonds and Rates", "ETFs", "IPOs"],
  );
});

test("market catalog is generously populated per group with honest coverage", () => {
  const counts = catalogCountsByGroup();
  assert.ok(counts.indices >= 12);
  assert.ok(counts.fx >= 12);
  assert.ok(counts.cryptocurrency >= 10);
  assert.ok(counts.shares >= 15);
  assert.ok(counts.commodities >= 8);
  assert.ok(counts.bonds_and_rates >= 8);
  assert.ok(counts.etfs >= 12);
  assert.ok(counts.ipos >= 1);

  const instruments = allMarketInstruments();
  assert.ok(instruments.length >= 90);
  assert.ok(instruments.every((item) => MARKET_GROUPS.includes(item.group)));
  assert.ok(instruments.every((item) => ["live", "proxy", "awaiting"].includes(item.coverage)));
  assert.ok(instruments.some((item) => item.coverage === "live" && item.symbol === "ES"));
  assert.ok(instruments.some((item) => item.coverage === "live" && item.symbol === "QQQ"));
  assert.ok(instruments.some((item) => item.coverage === "awaiting" && item.group === "ipos"));

  const ipo = getMarketInstrument("ipo-coverage");
  assert.ok(ipo);
  assert.equal(ipo.coverage, "awaiting");
  assert.match(ipo.name, /awaiting verified provider/i);
  assert.equal(coverageLabel("awaiting"), "Awaiting coverage");
});

test("Markets catalog powers the Trading Desk with honest coverage labels", async () => {
  const [page, browser, styles, catalog, desk] = await Promise.all([
    read("../app/terminal/page.tsx"),
    read("../app/terminal/components/MarketsBrowser.tsx"),
    read("../app/mission-control.css"),
    read("../app/lib/markets/market-catalog.ts"),
    read("../app/terminal/components/TradingDeskOS.tsx"),
  ]);

  assert.match(page, /TradingDeskOS/);
  assert.match(page, /resolveMembershipTier/);
  assert.match(page, /createProgressiveAccess/);
  assert.match(page, /DashboardCandlestickChart|getConfiguredFmpCandlesForInstruments/);
  assert.match(desk, /MARKET_CATALOG/);
  assert.match(desk, /preferred-platform|Preferred platform|resolvePlatformLaunch/);

  assert.match(browser, /Markets/);
  assert.match(browser, /MARKET_CATALOG/);
  assert.match(browser, /Awaiting coverage|coverageLabel/);
  assert.match(browser, /No live quote or chart is shown/);
  assert.doesNotMatch(browser, /Math\.random|fakePrice|mockQuote|demoCandle/i);

  assert.match(styles, /\.deskMarkets|\.tmMarketsSidebar/);
  assert.match(styles, /\.deskHero|\.tmMarketsRootToggle/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(catalog, /coverage: 'live'|"live"|'live'|"proxy"|"awaiting"/);
});
