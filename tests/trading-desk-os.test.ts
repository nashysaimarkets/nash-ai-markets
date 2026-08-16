import assert from "node:assert/strict";
import test from "node:test";
import { getMarketInstrument } from "../app/lib/markets/market-catalog.ts";
import {
  applyPreset,
  createDefaultWorkspace,
  normalizeWorkspace,
} from "../app/terminal/lib/desk-workspace.ts";
import { DESK_WIDGET_IDS, isDeskWidgetId } from "../app/terminal/lib/desk-widgets.ts";
import { createEdgeBrief } from "../app/terminal/lib/edge-brief.ts";
import { createCatalystRadar } from "../app/terminal/lib/catalyst-radar.ts";
import { readSessionClock } from "../app/terminal/lib/session-clock.ts";
import {
  PREFERRED_PLATFORM_IDS,
  resolvePlatformEmbed,
  resolvePlatformLaunch,
  tradingViewSymbol,
} from "../app/terminal/lib/preferred-platforms.ts";
import { createUnavailableSnapshot } from "../app/lib/market-data.ts";
import { readFileSync } from "node:fs";

test("desk widget registry includes distinctive tools", () => {
  for (const id of [
    "primary-chart",
    "edge-brief",
    "catalyst-radar",
    "structure-map",
    "preferred-platform",
    "platform-embed",
    "risk-toolkit",
    "journal-lite",
    "freshness-trust",
  ]) {
    assert.equal(isDeskWidgetId(id), true);
  }
  assert.equal(DESK_WIDGET_IDS.length >= 16, true);
});

test("dashboard desk entry requests ES charts and the desk honours explicit entry context", () => {
  const dashboard = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  const commandCentre = readFileSync(new URL("../app/dashboard/components/MarketCommandCentre.tsx", import.meta.url), "utf8");
  const desk = readFileSync(new URL("../app/terminal/components/TradingDeskOS.tsx", import.meta.url), "utf8");

  assert.match(dashboard, /\/terminal\?market=es&view=charts/);
  assert.match(commandCentre, /\/terminal\?market=es&view=charts/);
  assert.match(desk, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(desk, /requestedMarketId \? \{ \.\.\.restored, activeMarketId: requestedMarketId \} : restored/);
  assert.match(desk, /setDeskView\(requestedView \?\? storedView\)/);
});

test("workspace normalises legacy nq favourite to ixic without changing selection semantics", () => {
  const normalized = normalizeWorkspace({
    favourites: ["es", "nq", "vix"],
    activeMarketId: "nq",
    compareIds: ["nq", "qqq"],
  });
  assert.deepEqual(normalized.favourites, ["es", "ixic", "vix"]);
  assert.equal(normalized.activeMarketId, "ixic");
  assert.deepEqual(normalized.compareIds, ["ixic", "qqq"]);
  assert.equal(getMarketInstrument(normalized.activeMarketId)?.symbol, "IXIC");
});

test("workspace prefs persist preferred platform fields", () => {
  const base = createDefaultWorkspace();
  assert.equal(base.preferredPlatformId, "tradingview");
  assert.match(base.externalUrlTemplate, /^https:\/\//);
  const normalized = normalizeWorkspace({
    ...base,
    preferredPlatformId: "coinbase",
    externalUrlTemplate: "https://broker.example/q/{SYMBOL}",
  });
  assert.equal(normalized.preferredPlatformId, "coinbase");
  assert.equal(normalized.externalUrlTemplate, "https://broker.example/q/{SYMBOL}");
  assert.equal(normalizeWorkspace({ preferredPlatformId: "not-real" }).preferredPlatformId, "tradingview");
});

test("presets include preferred platform widget", () => {
  const crypto = applyPreset("crypto");
  assert.ok(crypto.widgets.includes("preferred-platform"));
  assert.ok(!crypto.hidden.includes("preferred-platform"));
});

test("session clock returns published ET phases without inventing holidays", () => {
  const weekend = readSessionClock(new Date("2026-07-25T15:00:00.000Z")); // Saturday
  assert.equal(weekend.phase, "weekend");
  assert.ok(weekend.countdownLabel);
  const rth = readSessionClock(new Date("2026-07-23T15:00:00.000Z")); // Thursday ~11:00 ET
  assert.equal(rth.phase, "rth");
  assert.match(rth.source, /09:30/);
});

test("edge brief fails closed for awaiting coverage", () => {
  const ipo = getMarketInstrument("ipo-coverage");
  assert.ok(ipo);
  const brief = createEdgeBrief({
    instrument: ipo,
    snapshot: createUnavailableSnapshot(),
    candle: null,
    structure: null,
    deskSignals: null,
    events: [],
    session: readSessionClock(new Date("2026-07-23T15:00:00.000Z")),
    snapshotAge: "age unavailable",
  });
  assert.equal(brief.status, "insufficient");
  assert.match(brief.secondsCopy, /not invent/i);
});

test("catalyst radar keeps earnings and news unavailable honestly", () => {
  const es = getMarketInstrument("es")!;
  const radar = createCatalystRadar({
    events: [{
      time: "Mon 14:00",
      name: "CPI",
      risk: "HIGH",
      at: new Date(Date.now() + 3_600_000).toISOString(),
    }],
    active: es,
    favourites: [es],
  });
  assert.equal(radar.items.length, 1);
  assert.ok(radar.unavailable.some((item) => item.kind === "earnings"));
  assert.ok(radar.unavailable.some((item) => item.kind === "news"));
});

test("catalyst radar excludes past events even when display labels remain", () => {
  const es = getMarketInstrument("es")!;
  const radar = createCatalystRadar({
    events: [{
      time: "Mon 14:00",
      name: "CPI",
      risk: "HIGH",
      at: new Date(Date.now() - 3_600_000).toISOString(),
    }],
    active: es,
    favourites: [es],
    now: Date.now(),
  });
  assert.equal(radar.items.length, 0);
});

test("preferred platforms launch mapped symbols and refuse unknown classes", () => {
  const aapl = getMarketInstrument("aapl")!;
  const btc = getMarketInstrument("btc")!;
  const eurusd = getMarketInstrument("eurusd")!;
  const es = getMarketInstrument("es")!;

  assert.equal(PREFERRED_PLATFORM_IDS.includes("tradingview"), true);
  const tv = resolvePlatformLaunch("tradingview", es);
  assert.equal(tv.status, "ready");
  if (tv.status === "ready") assert.match(tv.url, /tradingview\.com/);

  const robinhoodEquity = resolvePlatformLaunch("robinhood", aapl);
  assert.equal(robinhoodEquity.status, "ready");
  const robinhoodFx = resolvePlatformLaunch("robinhood", eurusd);
  assert.equal(robinhoodFx.status, "unavailable");

  const coinbase = resolvePlatformLaunch("coinbase", btc);
  assert.equal(coinbase.status, "ready");
  const coinbaseShare = resolvePlatformLaunch("coinbase", aapl);
  assert.equal(coinbaseShare.status, "unavailable");

  const external = resolvePlatformLaunch("external", aapl, "https://broker.example/{SYMBOL}");
  assert.equal(external.status, "ready");
  if (external.status === "ready") assert.match(external.url, /AAPL/);
  const externalBad = resolvePlatformLaunch("external", aapl, "javascript:alert(1)");
  assert.equal(externalBad.status, "unavailable");
});

test("tradingview embed is optional and sandboxed-ready only for tradingview", () => {
  const qqq = getMarketInstrument("qqq")!;
  assert.ok(tradingViewSymbol(qqq));
  const embed = resolvePlatformEmbed("tradingview", qqq);
  assert.equal(embed.status, "ready");
  if (embed.status === "ready") {
    assert.match(embed.src, /s\.tradingview\.com\/widgetembed/);
    assert.match(embed.detail, /Official TradingView public widget/);
    assert.match(embed.detail, /never enter Bullseye’s verified feed or decision engine/);
  }
  const ibkr = resolvePlatformEmbed("interactive-brokers", qqq);
  assert.equal(ibkr.status, "unavailable");
});
