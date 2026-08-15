"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MARKETING_PREVIEW_STATES,
  getMarketingPreviewFixture,
  type MarketingPreviewStateId,
} from "../lib/illustrative-fixtures.ts";
import { MarketingPreviewChart } from "./MarketingPreviewChart.tsx";

const NAV_ITEMS = [
  "Dashboard",
  "Posture",
  "Markets",
  "Evidence",
  "Levels",
  "Watchlist",
  "Alerts",
  "Reports",
  "Settings",
] as const;

function toneClass(tone: string) {
  return `is-${tone}`;
}

function formatLevel(value: number) {
  return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sessionClockLabel() {
  return "21 Jul 2026 · 15:55 UK · Regular session";
}

export function MarketingPreviewSurface({ initialState = "wait" }: { initialState?: MarketingPreviewStateId }) {
  const [stateId, setStateId] = useState<MarketingPreviewStateId>(initialState);
  const fixture = useMemo(() => getMarketingPreviewFixture(stateId), [stateId]);
  const { posture, levels, candles, crossMarket } = fixture;
  const latest = candles.at(-1)!;
  const first = candles[0]!;
  const net = latest.close - first.close;
  const netPct = (net / first.close) * 100;
  const avgRange =
    candles.slice(-20).reduce((sum, candle) => sum + (candle.high - candle.low), 0) / Math.min(20, candles.length);
  const upBars = candles.filter((candle) => candle.close >= candle.open).length;
  const trendBias = netPct > 0.08 ? "Rising" : netPct < -0.08 ? "Falling" : "Balanced";
  const momentum = Math.abs(netPct) > 0.12 ? "Expanding" : "Contained";
  const structure = posture.leanTone === "mixed" ? "Range" : posture.leanTone === "neutral" ? "Compression" : "Directional";
  const volumeTone = candles.slice(-8).reduce((sum, candle) => sum + candle.volume, 0) >
    candles.slice(0, 8).reduce((sum, candle) => sum + candle.volume, 0)
    ? "Building"
    : "Steady";

  return (
    <div className="mpShell" data-marketing-preview="illustrative" data-state={fixture.id}>
      <aside className="mpSidebar" aria-label="Illustrative Bullseye navigation">
        <div className="mpBrand">
          <Image src="/brand/logo-mark.svg" width={36} height={36} alt="" aria-hidden="true" />
          <div>
            <strong>BULLSEYE</strong>
            <span>NASH AI Markets</span>
          </div>
        </div>
        <nav className="mpNav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              className={item === "Dashboard" ? "is-active" : undefined}
              aria-current={item === "Dashboard" ? "page" : undefined}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="mpSidebarFoot">
          <span>ILLUSTRATIVE SESSION SNAPSHOT</span>
          <small>Not live market data</small>
        </div>
      </aside>

      <div className="mpMain">
        <header className="mpTopBar">
          <div>
            <span className="mpEyebrow">MEMBER DASHBOARD · PRESENTATION</span>
            <h1>Today&apos;s command centre</h1>
          </div>
          <div className="mpTopMeta">
            <span className="mpSessionPill">{sessionClockLabel()}</span>
            <div className="mpStateSwitcher" role="tablist" aria-label="Illustrative screenshot states">
              {MARKETING_PREVIEW_STATES.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={stateId === id}
                  className={stateId === id ? "is-active" : undefined}
                  onClick={() => setStateId(id)}
                >
                  {getMarketingPreviewFixture(id).label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <section className="mpPosture" aria-labelledby="mp-posture-title">
          <header>
            <div>
              <span className="mpEyebrow">TODAY&apos;S POSTURE</span>
              <h2 id="mp-posture-title">{posture.headline}</h2>
              <p>{posture.summary}</p>
            </div>
            <span className={`mpPill ${toneClass(posture.permissionTone)}`}>{posture.participation}</span>
          </header>
          <div className="mpDecisionGrid">
            <article>
              <span>Participation</span>
              <strong className={toneClass(posture.permissionTone)}>{posture.participation}</strong>
            </article>
            <article>
              <span>Observed market lean</span>
              <strong className={toneClass(posture.leanTone)}>{posture.lean}</strong>
            </article>
            <article>
              <span>Confidence</span>
              <strong>{posture.confidence}</strong>
              <small>{posture.confidenceDetail}</small>
            </article>
            <article>
              <span>Primary condition</span>
              <strong>{posture.primaryCondition}</strong>
            </article>
          </div>
        </section>

        <div className="mpWorkspace">
          <MarketingPreviewChart candles={candles} levels={levels} stateLabel={fixture.label} />

          <aside className="mpSideStack" aria-label="Illustrative support panels">
            <section className="mpPanel">
              <header>
                <span>KEY LEVELS</span>
                <h3>Session map</h3>
              </header>
              <ul>
                <li><span>R2</span><strong>{formatLevel(levels.r2)}</strong></li>
                <li><span>R1</span><strong>{formatLevel(levels.r1)}</strong></li>
                <li><span>Pivot</span><strong>{formatLevel(levels.pivot)}</strong></li>
                <li><span>S1</span><strong>{formatLevel(levels.s1)}</strong></li>
                <li><span>S2</span><strong>{formatLevel(levels.s2)}</strong></li>
              </ul>
            </section>

            <section className="mpPanel">
              <header>
                <span>OVERNIGHT / SESSION</span>
                <h3>Range context</h3>
              </header>
              <ul>
                <li><span>Overnight high</span><strong>{formatLevel(levels.overnightHigh)}</strong></li>
                <li><span>Overnight low</span><strong>{formatLevel(levels.overnightLow)}</strong></li>
                <li><span>Overnight range</span><strong>{formatLevel(levels.overnightRange)}</strong></li>
                <li><span>Overnight midpoint</span><strong>{formatLevel(levels.overnightMidpoint)}</strong></li>
                <li><span>Expected move</span><strong>{formatLevel(levels.expectedMove)}</strong></li>
                <li><span>Session status</span><strong>{posture.sessionStatus}</strong></li>
              </ul>
            </section>

            <section className="mpPanel">
              <header>
                <span>MARKET WEATHER</span>
                <h3>{posture.weather}</h3>
              </header>
              <p>{posture.weatherDetail}</p>
            </section>

            <section className="mpPanel">
              <header>
                <span>CROSS-MARKET</span>
                <h3>Related cards</h3>
              </header>
              <div className="mpCrossGrid">
                {crossMarket.map((card) => (
                  <article key={card.symbol} className={toneClass(card.tone)}>
                    <span>{card.symbol}</span>
                    <strong>{card.change}</strong>
                    <small>{card.label}</small>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <section className="mpBottomStrip" aria-label="Illustrative analytics strip">
          <article className="mpPanel">
            <header>
              <span>EVIDENCE SUMMARY</span>
              <h3>Illustrative stack</h3>
            </header>
            <ul className="mpEvidence">
              {posture.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="mpPanel mpMiniMetrics">
            <header>
              <span>SESSION ANALYTICS</span>
              <h3>Compact read</h3>
            </header>
            <div className="mpMetricGrid">
              <div><span>Trend</span><strong>{trendBias}</strong></div>
              <div><span>Momentum</span><strong>{momentum}</strong></div>
              <div><span>Structure</span><strong>{structure}</strong></div>
              <div><span>Volume</span><strong>{volumeTone}</strong></div>
              <div><span>Net</span><strong>{`${net >= 0 ? "+" : ""}${net.toFixed(2)} (${netPct >= 0 ? "+" : ""}${netPct.toFixed(2)}%)`}</strong></div>
              <div><span>Avg range</span><strong>{avgRange.toFixed(2)}</strong></div>
              <div><span>Up bars</span><strong>{`${upBars}/${candles.length}`}</strong></div>
              <div><span>Last</span><strong>{formatLevel(latest.close)}</strong></div>
            </div>
          </article>
          <article className="mpPanel">
            <header>
              <span>RECENT POSTURE HISTORY</span>
              <h3>Session trail</h3>
            </header>
            <ul>
              {posture.postureHistory.map((item) => (
                <li key={`${item.label}-${item.lean}`}>
                  <span>{item.label}</span>
                  <strong>{item.lean}</strong>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <footer className="mpFooter">
          <p>
            Illustrative session data for product demonstration. Not live market data and not financial advice.
          </p>
          <Link href="/dashboard">Return to verified dashboard</Link>
        </footer>
      </div>
    </div>
  );
}
