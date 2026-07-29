import type { MarketQuote } from "../../lib/market-data.ts";

type Stats = { latest: number; high: number; low: number; firstAvailableClose: number; change: number; percentageChange: number } | null;
type Props = { verified: boolean; regime: string; bias: string; confidence: number | null; risk: string; quotes: MarketQuote[]; stats: Stats; provider: string; dataStatus: string; lastUpdated: string };
const quote = (quotes: MarketQuote[], symbol: string) => quotes.find((item) => item.symbol === symbol);
const price = (value: number | null | undefined) => value == null ? "Unavailable" : value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LiveMarketSummary({ verified, regime, bias, confidence, risk, quotes, stats, provider, dataStatus, lastUpdated }: Props) {
  const vix = quote(quotes, "VIX"); const twoYear = quote(quotes, "US2Y"); const tenYear = quote(quotes, "US10Y"); const dollar = quote(quotes, "DXY");
  const strip = [
    { label: "ES reference", value: price(stats?.latest), change: stats ? `${stats.percentageChange >= 0 ? "+" : ""}${stats.percentageChange.toFixed(2)}% / 24h` : "History unavailable" },
    { label: "VIX", value: vix?.value ?? "Unavailable", change: vix?.change ?? "Change unavailable" },
    { label: "US 2-year", value: twoYear?.value ?? "Unavailable", change: twoYear?.change ?? "Change unavailable" },
    { label: "US 10-year", value: tenYear?.value ?? "Unavailable", change: tenYear?.change ?? "Change unavailable" },
    { label: "DXY", value: dollar?.value ?? "Unavailable", change: dollar?.change ?? "Change unavailable" },
  ];
  const items = [
    ["Provider series level", stats ? price(stats.latest) : "Unavailable", "Latest verified FMP ESUSD candle close"],
    ["Overnight move", "Unavailable", "Session boundary is not supplied by the current candle payload"],
    ["Expected move", "Unavailable", "Not supplied by the verified provider"],
    ["VIX", vix?.value ?? "Unavailable", vix ? `${vix.change} provider change` : "Volatility quote is unavailable"],
    ["US 10-year", tenYear?.value ?? "Unavailable", tenYear ? "Latest verified Treasury observation" : "Yield observation is unavailable"],
    ["US dollar", dollar?.value ?? "Unavailable", dollar ? `${dollar.change} provider change` : "Dollar observation is unavailable"],
    ["Market breadth", "Unavailable", "No verified breadth provider is connected"],
    ["First available close", price(stats?.firstAvailableClose), "First verified candle close in the rolling 24-hour window"],
    ["24h range", stats ? `${price(stats.low)} – ${price(stats.high)}` : "Unavailable", "Rolling 24h low to high; not an official exchange session"],
  ];
  const customerItems = items.map(([label, value, detail]) => [
    label === "First available close" ? "Session opening reference" : label,
    value,
    detail,
  ] as const);
  return <section className="liveMarketSummary" aria-labelledby="live-market-summary-title">
    <header><div><span className="eliteEyebrow">LIVE MARKET SUMMARY</span><h2 id="live-market-summary-title">Current decision context</h2><p>Plain-language observations and deterministic classifications. Nothing here guarantees a future outcome.</p></div><div className="summaryHealth"><strong>{dataStatus}</strong><span>{provider}</span><small>{lastUpdated}</small></div></header>
    <div className="marketStatusStrip" aria-label="Verified market status strip">{strip.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.change} · {dataStatus.toLowerCase()} · {lastUpdated}</small></article>)}</div>
    <div className="summaryDecision"><article><span>Market regime</span><strong>{verified ? regime : "Unavailable"}</strong><small>{verified ? "Derived from verified volatility and cross-asset inputs" : "Awaiting complete verified inputs"}</small></article><article><span>Directional bias</span><strong>{verified ? bias : "Neutral safety state"}</strong><small>Deterministic classification, not a calibrated win probability</small></article><article><span>Confidence</span><strong>{verified && confidence !== null ? `${confidence}/100` : "Withheld"}</strong><small>{verified ? "Evidence quality and agreement" : "No score from incomplete evidence"}</small></article><article><span>Overall risk</span><strong>{verified ? risk : "Unrated"}</strong><small>Review alongside catalysts and invalidation</small></article></div>
    <dl>{customerItems.map(([label, value, detail]) => <div key={label}><dt>{label}</dt><dd>{value}<small>{detail}</small></dd></div>)}</dl>
  </section>;
}
