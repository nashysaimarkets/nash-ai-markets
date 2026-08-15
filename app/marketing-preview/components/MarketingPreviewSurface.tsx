"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MARKETING_PREVIEW_STATES,
  getMarketingPreviewFixture,
  type MarketingPreviewStateId,
} from "../lib/illustrative-fixtures.ts";
import { MarketingPreviewChart } from "./MarketingPreviewChart.tsx";

function toneClass(tone: string) {
  return `is-${tone}`;
}

function formatLevel(value: number) {
  return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function MarketingPreviewSurface({ initialState = "wait" }: { initialState?: MarketingPreviewStateId }) {
  const [stateId, setStateId] = useState<MarketingPreviewStateId>(initialState);
  const fixture = useMemo(() => getMarketingPreviewFixture(stateId), [stateId]);
  const { posture, levels, candles, crossMarket } = fixture;

  return (
    <main className="mpPage" data-marketing-preview="illustrative" data-state={fixture.id}>
      <section className="mpBanner" role="note">
        <div>
          <span>ILLUSTRATIVE SESSION SNAPSHOT</span>
          <h1>Bullseye marketing preview</h1>
          <p>Private screenshot and launch-video surface. Presentation fixtures only.</p>
        </div>
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
      </section>

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
        <details className="mpEngineDetails">
          <summary>Engine detail (secondary · illustrative)</summary>
          <div className="mpEngineColumns">
            <div>
              <span>Supporting</span>
              <ul>
                {posture.supporting.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <span>Opposing</span>
              <ul>
                {posture.opposing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </details>
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
              <span>EVIDENCE SUMMARY</span>
              <h3>Illustrative stack</h3>
            </header>
            <ul className="mpEvidence">
              {posture.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mpPanel">
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

      <footer className="mpFooter">
        <p>
          Illustrative session data for product demonstration. Not live market data and not financial advice.
        </p>
        <Link href="/dashboard">Return to verified dashboard</Link>
      </footer>
    </main>
  );
}
