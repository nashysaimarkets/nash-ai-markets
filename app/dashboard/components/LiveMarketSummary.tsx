import type { MarketQuote } from "../../lib/market-data.ts";

type Stats = { latest: number; high: number; low: number; previousClose: number | null; change: number; percentageChange: number } | null;
type Props = { verified: boolean; regime: string; bias: string; confidence: number | null; risk: string; quotes: MarketQuote[]; stats: Stats; provider: string; dataStatus: string; lastUpdated: string };
const quote = (quotes: MarketQuote[], symbol: string) => quotes.find((item) => item.symbol === symbol);
const price = (value: number | null | undefined) => value == null ? "Unavailable" : value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LiveMarketSummary({ verified, regime, bias, confidence, risk, quotes, stats, provider, dataStatus, lastUpdated }: Props) {
  const vix = quote(quotes, "VIX"); const tenYear = quote(quotes, "US10Y"); const dollar = quote(quotes, "DXY");
  const items = [
    ["Futures level", stats ? price(stats.latest) : "Unavailable", "Latest verified ES candle close"],
    ["Overnight move", "Unavailable", "Session boundary is not supplied by the current candle payload"],
    ["Expected move", "Unavailable", "Not supplied by the verified provider"],
    ["VIX", vix?.value ?? "Unavailable", vix ? `${vix.change} provider change` : "Volatility quote is unavailable"],
    ["US 10-year", tenYear?.value ?? "Unavailable", tenYear ? "Latest verified Treasury observation" : "Yield observation is unavailable"],
    ["US dollar", dollar?.value ?? "Unavailable", dollar ? `${dollar.change} provider change` : "Dollar observation is unavailable"],
    ["Market breadth", "Unavailable", "No verified breadth provider is connected"],
    ["Previous close", price(stats?.previousClose), "Last candle before the current 24-hour range"],
    ["Session range", stats ? `${price(stats.low)} – ${price(stats.high)}` : "Unavailable", "Derived locally from verified candles"],
  ];
  return <section className="liveMarketSummary" aria-labelledby="live-market-summary-title">
    <header><div><span className="eliteEyebrow">LIVE MARKET SUMMARY</span><h2 id="live-market-summary-title">Current decision context</h2><p>Plain-language observations and deterministic classifications. Nothing here guarantees a future outcome.</p></div><div className="summaryHealth"><strong>{dataStatus}</strong><span>{provider}</span><small>{lastUpdated}</small></div></header>
    <div className="summaryDecision"><article><span>Market regime</span><strong>{verified ? regime : "Unavailable"}</strong><small>{verified ? "Derived from verified volatility and cross-asset inputs" : "Awaiting complete verified inputs"}</small></article><article><span>Directional bias</span><strong>{verified ? bias : "Neutral safety state"}</strong><small>Deterministic classification, not a calibrated win probability</small></article><article><span>Confidence</span><strong>{verified && confidence !== null ? `${confidence}/100` : "Withheld"}</strong><small>{verified ? "Evidence quality and agreement" : "No score from incomplete evidence"}</small></article><article><span>Overall risk</span><strong>{verified ? risk : "Unrated"}</strong><small>Review alongside catalysts and invalidation</small></article></div>
    <dl>{items.map(([label, value, detail]) => <div key={label}><dt>{label}</dt><dd>{value}<small>{detail}</small></dd></div>)}</dl>
  </section>;
}
