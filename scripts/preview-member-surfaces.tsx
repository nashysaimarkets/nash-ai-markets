/**
 * Renders authenticated member surfaces to standalone HTML for design review.
 *
 * The audit harness can only reach public routes unless AUDIT_USER_EMAIL and
 * AUDIT_USER_PASSWORD are configured, which leaves the Command Centre — the
 * surface most in need of visual review — impossible to inspect. This renders
 * the same components the route renders, against a fixed synthetic fixture, and
 * inlines the real stylesheets so layout and hierarchy can be screenshotted.
 *
 * The fixture is invented data for layout review only. Nothing here is a market
 * value and nothing is served to customers; output lands in audit-output/preview.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MarketCommandCentre } from "../app/dashboard/components/MarketCommandCentre.tsx";
import { buildDeskGreeting } from "../app/dashboard/lib/market-weather.ts";
import { buildDashboardCommandSummary } from "../app/dashboard/lib/dashboard-command-summary.ts";
import { buildAiMarketInsight } from "../app/lib/ai-market-insight.ts";
import { buildOracleBundle } from "../app/lib/oracle/build-oracle-bundle.ts";
import { primaryLevel } from "../app/dashboard/lib/command-centre.ts";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import { readSessionClock } from "../app/terminal/lib/session-clock.ts";
import { resolveSessionMarketVideos } from "../app/lib/market-video/session-placement.ts";
import type { MarketVideoSelection } from "../app/lib/market-video/types.ts";
import { sanitizeForClient } from "../app/lib/serialize-for-client.ts";
import { createUnavailableSnapshot } from "../app/lib/market-data.ts";
import type { MarketSnapshot } from "../app/lib/market-data.ts";
import type { CustomerCandleSeries } from "../app/lib/providers/financial-modeling-prep-candles.ts";
import type { OhlcvPoint } from "../app/terminal/lib/visual-terminal.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT_DIR = join(ROOT, "audit-output", "preview");

/** Mid-session on a Thursday so the session clock lands in US cash hours. */
const NOW = Date.parse("2026-07-30T18:20:00.000Z");

function syntheticCandles(): CustomerCandleSeries {
  const candles: OhlcvPoint[] = [];
  let price = 6248;
  // Deterministic pseudo-random walk keeps screenshots comparable between runs.
  let seed = 20260730;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let index = 0; index < 96; index += 1) {
    const drift = (next() - 0.46) * 6;
    const open = price;
    const close = open + drift;
    const high = Math.max(open, close) + next() * 2.4;
    const low = Math.min(open, close) - next() * 2.4;
    candles.push({
      time: NOW - (96 - index) * 5 * 60_000,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round(1200 + next() * 5400),
    });
    price = close;
  }
  return {
    symbol: "ESU26",
    contract: "ESU26",
    instrumentName: "E-mini S&P 500",
    exchange: "CME",
    instrumentDetail: "E-mini S&P 500 continuous front month",
    timeframe: "5m",
    classification: "delayed",
    dataAgeMs: 15 * 60_000,
    provider: "Financial Modeling Prep",
    status: "delayed",
    asOf: new Date(NOW - 15 * 60_000).toISOString(),
    candles,
    failureCategory: null,
  };
}

function syntheticSnapshot(): MarketSnapshot {
  return {
    status: "LIVE",
    source: "Financial Modeling Prep (delayed)",
    asOf: new Date(NOW - 15 * 60_000).toISOString(),
    quotes: [
      { symbol: "ES", label: "ES", value: "6262.25", change: "+14.50", direction: "up" },
      { symbol: "NQ", label: "NQ", value: "22841.00", change: "+68.25", direction: "up" },
      { symbol: "VIX", label: "VIX", value: "14.82", change: "-0.46", direction: "down" },
      { symbol: "US2Y", label: "2Y", value: "3.92%", change: "-0.03", direction: "down" },
      { symbol: "US10Y", label: "10Y", value: "4.21%", change: "-0.02", direction: "down" },
      { symbol: "DXY", label: "DXY", value: "97.86", change: "-0.18", direction: "down" },
    ],
    levels: [
      { label: "R2", value: "6296", note: "prior swing high", type: "resistance" },
      { label: "R1", value: "6274", note: "overnight high", type: "resistance" },
      { label: "S1", value: "6238", note: "overnight low", type: "support" },
      { label: "S2", value: "6212", note: "prior session low", type: "support" },
    ],
    events: [
      { time: new Date(NOW + 105 * 60_000).toISOString(), name: "US Consumer Confidence", risk: "MED" },
      { time: new Date(NOW + 20 * 60 * 60_000).toISOString(), name: "US CPI", risk: "HIGH" },
    ],
    bias: "BULLISH",
    risk: "MODERATE",
    summary: "Index firm with volatility contained and yields easing.",
    evidence: { trend: 72, momentum: 64, volatility: 32, breadth: 58, macro: 61 },
  };
}

type Surface = { id: string; title: string; markup: string };

/**
 * Synthetic published video for design review only. The real manifest is
 * operator-maintained and currently empty, so without this the Video Centre can
 * only ever be previewed in its unpublished state. This never reaches the
 * product: it exists solely so the embedded experience can be inspected.
 */
function previewVideoSelection(): MarketVideoSelection {
  return {
    available: true,
    video: {
      id: "preview-pre-market",
      youtubeVideoId: "aaaaaaaaaaa",
      type: "PRE_MARKET",
      marketDate: "2026-08-03",
      title: "Morning brief — ES holds the overnight range into CPI",
      summary: "Where price sits, which levels matter, and what would change the picture.",
      description: "Preview fixture.",
      publishedAt: new Date(NOW - 90 * 60_000).toISOString(),
      durationSeconds: 512,
      thumbnailUrl: "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg",
      watchUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
      embedUrl: "https://www.youtube-nocookie.com/embed/aaaaaaaaaaa?rel=0&modestbranding=1",
      status: "published",
      source: "youtube",
      verifiedAt: new Date(NOW - 90 * 60_000).toISOString(),
      keyTakeaways: [
        "ES is holding above the overnight low, so the constructive case stays intact while that level holds.",
        "Volatility is contained, but CPI later in the session is the obvious source of event risk.",
        "Wait for confirmation above the overnight high before treating strength as a continuation.",
      ],
      transcriptPreview:
        "Good morning. Before the open, the picture is steady rather than decisive. ES spent the overnight session inside a narrow range and is currently sitting in the upper half of it, with the dollar and yields both easing slightly...",
    },
  };
}

function renderCommandCentre(options: {
  snapshot: MarketSnapshot;
  candles: CustomerCandleSeries | null;
  videoOverride?: MarketVideoSelection;
}): string {
  const { snapshot, candles, videoOverride } = options;
  const session = readSessionClock(new Date(NOW));
  const intelligence = analyzeMarketSnapshot(snapshot);
  const shared = {
    intelligence,
    dataStatus: snapshot.status,
    providerStatus: "connected" as const,
    dataAgeMs: 15 * 60_000,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  };
  const decision = createTradingDecision({ ...shared, reasoning: intelligence.reasoning });
  const plan = createStructuredTradePlan({ ...shared, decision });
  const greeting = buildDeskGreeting("Chris", session, new Date(NOW));
  const summary = buildDashboardCommandSummary({
    snapshot,
    session,
    candleSeries: candles,
    decision,
    plan,
    signals: null,
    warnings: [],
    now: NOW,
  });
  const insight = buildAiMarketInsight({
    snapshot,
    intelligence,
    decision,
    plan,
    verified: true,
    now: NOW,
  });
  const support = primaryLevel(snapshot, "support");
  const resistance = primaryLevel(snapshot, "resistance");
  const oracle = buildOracleBundle({
    snapshot,
    intelligence,
    decision,
    plan,
    session,
    verified: true,
    freshnessLabel: summary.hero.delayedAgeLine,
    candles: candles?.candles ?? null,
    support: support?.value ?? null,
    resistance: resistance?.value ?? null,
    now: NOW,
  });
  const videos = resolveSessionMarketVideos({ phase: session.phase, now: NOW });

  const props = sanitizeForClient({
    greeting,
    tierLabel: "Elite",
    summary,
    insight,
    oracle,
    candleSeries: candles,
    now: NOW,
    marketVideo: videoOverride ?? videos.dashboardSelection,
    postMarketPendingNotice: videos.postMarketPendingNotice,
    archiveAvailable: videos.archive.length > 0,
    session,
    quotes: snapshot.quotes,
    plan,
  });

  return renderToStaticMarkup(createElement(MarketCommandCentre, props as never));
}

/**
 * globals.css is the single entry point, so its @import order is the real
 * cascade order. Tailwind is skipped because member surfaces use hand-written
 * class names; a small reset stands in for preflight.
 */
function inlineStylesheets(): string {
  const globals = readFileSync(join(ROOT, "app", "globals.css"), "utf8");
  const imports = [...globals.matchAll(/@import\s+"([^"]+)"/g)].map((match) => match[1]);
  const parts: string[] = [];
  for (const specifier of imports) {
    if (!specifier.startsWith(".")) continue;
    parts.push(`/* ${specifier} */\n${readFileSync(join(ROOT, "app", specifier), "utf8")}`);
  }
  parts.push(globals.replace(/@import\s+"[^"]+";?/g, ""));
  return parts.join("\n\n");
}

/**
 * No preview-only padding: .marketCommandCentre sets its own width with
 * calc(100% - 48px), so an extra wrapper inset would understate the real width
 * and hide genuine overflow.
 */
/**
 * next/font defines --font-geist-sans and --font-geist-mono on the served
 * document. Stylesheets here use them inside `font:` shorthands, and an
 * undefined custom property invalidates the whole shorthand, which silently
 * collapsed every heading and price to 16px Arial and made typography review
 * worthless. Standing in equivalent stacks keeps the preview faithful.
 */
const RESET = `
*,*::before,*::after{box-sizing:border-box}
:root{
  --font-geist-sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --font-geist-mono:ui-monospace,SFMono-Regular,Menlo,"Liberation Mono",monospace;
}
body{margin:0;background:#050a09;color:#eef3f0;
  font-family:var(--font-geist-sans);}
a{color:inherit}
`;

/** Mirrors MemberShell's DOM so container styles resolve as they do in the route. */
function page(surface: Surface, css: string): string {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${surface.title} — synthetic design preview</title>
<!-- Synthetic fixture for layout review only. Not market data. Never served. -->
<style>${RESET}</style>
<style>${css}</style>
</head>
<body>
<main class="memberDashboard">
<div id="member-content">${surface.markup}</div>
</main>
</body>
</html>`;
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const css = inlineStylesheets();
  const snapshot = syntheticSnapshot();

  const surfaces: Surface[] = [
    {
      id: "command-centre",
      title: "Command Centre",
      markup: renderCommandCentre({ snapshot, candles: syntheticCandles() }),
    },
    {
      id: "command-centre-nodata",
      title: "Command Centre (feeds unavailable)",
      markup: renderCommandCentre({ snapshot: createUnavailableSnapshot(), candles: null }),
    },
    {
      id: "command-centre-video",
      title: "Command Centre (video published)",
      markup: renderCommandCentre({
        snapshot,
        candles: syntheticCandles(),
        videoOverride: previewVideoSelection(),
      }),
    },
  ];

  for (const surface of surfaces) {
    const file = join(OUT_DIR, `${surface.id}.html`);
    writeFileSync(file, page(surface, css), "utf8");
    console.log(`${surface.id}: ${(page(surface, css).length / 1024).toFixed(0)}kb -> ${file}`);
  }
}

main();
