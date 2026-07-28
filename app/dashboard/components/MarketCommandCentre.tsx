import Link from "next/link";
import type { CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";
import type { SessionClockReading } from "../../terminal/lib/session-clock.ts";
import { AiMarketOutlook } from "./AiMarketOutlook";
import { HeroMarketChartLazy } from "./HeroMarketChartLazy";
import { MarketIntelligenceStrip, type StripQuote } from "./MarketIntelligenceStrip";

export type MarketCommandCentreProps = {
  memberName: string;
  tierLabel: string;
  dataStatus: string;
  dataAgeLabel: string;
  asOfLabel: string;
  session: SessionClockReading;
  candleSeries: CustomerCandleSeries | null;
  stripQuotes: StripQuote[];
  outlook: {
    verified: boolean;
    bullish: string;
    bearish: string;
    neutral: string;
    expectedMove: string;
    keySupport: string;
    keyResistance: string;
    riskRating: string;
    aiConfidence: string;
    disclaimer: string;
  };
};

export function MarketCommandCentre({
  memberName,
  tierLabel,
  dataStatus,
  dataAgeLabel,
  asOfLabel,
  session,
  candleSeries,
  stripQuotes,
  outlook,
}: MarketCommandCentreProps) {
  return (
    <div className="marketCommandCentre">
      <header className="mccCommandHeader">
        <div>
          <span className="mccEyebrow">MARKET COMMAND CENTRE</span>
          <h1>
            Good trading day, <em>{memberName}</em>
          </h1>
          <p>
            Premium workspace for verified delayed market preparation. {tierLabel} access · session {session.label}.
          </p>
        </div>
        <div className="mccHeaderMeta">
          <div>
            <span>Feed</span>
            <strong className={`mccFeedState is-${dataStatus}`}>{dataStatus}</strong>
            <small>{dataAgeLabel}</small>
          </div>
          <div>
            <span>As of</span>
            <strong>{asOfLabel}</strong>
            <small>Europe/London</small>
          </div>
          <div>
            <span>Session</span>
            <strong>{session.label}</strong>
            <small>{session.countdownLabel ? `${session.countdownLabel} · ${session.detail}` : session.detail}</small>
          </div>
        </div>
        <nav className="mccHeaderActions" aria-label="Command centre actions">
          <Link href="/terminal" className="mccPrimaryAction">
            <small>DESK</small>
            <b>Open Terminal</b>
          </Link>
          <Link href="/brief" className="mccSecondaryAction">
            <small>BRIEF</small>
            <b>Market brief</b>
          </Link>
        </nav>
      </header>

      <div className="mccDelayedBanner" role="status">
        <strong>Market Data: Delayed (~10 minutes)</strong>
        <span>All quotes and candles on this page use delayed verified provider feeds. Never treated as live.</span>
      </div>

      <MarketIntelligenceStrip quotes={stripQuotes} />

      {candleSeries ? (
        <HeroMarketChartLazy series={candleSeries} sessionPhase={session.phase} />
      ) : (
        <section className="mccHeroChart mccChartUnavailable" role="status">
          <strong>Hero chart awaiting verified ES candles</strong>
          <p>Membership or provider coverage is required before the interactive workspace can render OHLCV.</p>
          <span className="mccDelayedBadge">Market Data: Delayed (~10 minutes)</span>
        </section>
      )}

      <AiMarketOutlook {...outlook} />
    </div>
  );
}
