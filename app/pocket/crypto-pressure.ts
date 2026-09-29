const PAIR = /(?:^|[^A-Z])(BTC|XBT|ETH|SOL|XRP|DOGE|ADA|BNB|AVAX|LTC)[\s/\-]*(USDT|USDC|USD)(?=$|[^A-Z])/i;

export function cryptoPair(label: string): string | null {
  const match = label.toUpperCase().match(PAIR);
  return match ? `${match[1] === "XBT" ? "BTC" : match[1]}${match[2]}` : null;
}

export type CryptoPanelRead = {
  pair: string; timeframe: string; readable: boolean; limitation: string;
  fundingRatePct: number | null; openInterestChangePct: number | null;
  longShortRatio: number | null; longLiquidations: number | null; shortLiquidations: number | null;
  clusters: { side: "LONG" | "SHORT"; price: number }[];
};
export type CryptoPressureResult = {
  status: "VERIFIED" | "LIMITED" | "UNVERIFIED"; pair: string; observations: string[];
  overlap: string[]; conflict: string; caution: string;
};

export function interpretCryptoPanel(read: CryptoPanelRead, instrument: string, levels: { kind: string; price: string }[], chartDirection: "BULLISH" | "BEARISH" | "NEUTRAL"): CryptoPressureResult {
  const expected = cryptoPair(instrument), actual = cryptoPair(read.pair);
  const held = (reason: string): CryptoPressureResult => ({ status: "UNVERIFIED", pair: actual || "UNKNOWN", observations: [], overlap: [], conflict: reason, caution: "No trading direction is inferred." });
  if (!expected || !actual || expected !== actual) return held("The derivatives panel and price chart must show the same explicit crypto pair.");
  if (!read.readable || !read.timeframe.trim()) return held(read.limitation || "Panel labels or observation period cannot be verified.");
  const observations: string[] = [];
  const finite = (value: number | null) => value !== null && Number.isFinite(value);
  if (finite(read.fundingRatePct)) observations.push(`Funding ${read.fundingRatePct! > 0 ? "+" : ""}${read.fundingRatePct}% (${read.fundingRatePct! > 0 ? "longs paying shorts" : read.fundingRatePct! < 0 ? "shorts paying longs" : "neutral"}).`);
  if (finite(read.openInterestChangePct)) observations.push(`Open interest changed ${read.openInterestChangePct! > 0 ? "+" : ""}${read.openInterestChangePct}% over the displayed ${read.timeframe}.`);
  if (finite(read.longShortRatio) && read.longShortRatio! > 0) observations.push(`Displayed long/short ratio: ${read.longShortRatio}.`);
  if (finite(read.longLiquidations) && finite(read.shortLiquidations)) observations.push(`Observed liquidations: long ${read.longLiquidations}, short ${read.shortLiquidations} (panel units).`);
  const verifiedLevels = levels.flatMap((level) => {
    const price = Number(level.price.replaceAll(",", ""));
    return ["support", "resistance", "pivot"].includes(level.kind) && level.price.trim() && Number.isFinite(price) && price > 0 ? [{ kind: level.kind, price }] : [];
  });
  const overlap = read.clusters.filter((cluster) => (cluster.side === "LONG" || cluster.side === "SHORT") && Number.isFinite(cluster.price) && cluster.price > 0).slice(0, 4).flatMap((cluster) => {
    const level = verifiedLevels.find((candidate) => Math.abs(candidate.price - cluster.price) <= Math.min(candidate.price * 0.005, 50));
    return level ? [`Visible ${cluster.side.toLowerCase()} liquidation cluster at ${cluster.price} lies near verified ${level.kind} ${level.price}.`] : [];
  });
  if (!observations.length && !overlap.length) return held("No readable funding, open interest, ratio, liquidation totals or cluster levels were found.");
  const crowdedLong = finite(read.fundingRatePct) && read.fundingRatePct! > 0 && finite(read.longShortRatio) && read.longShortRatio! >= 1.5;
  const crowdedShort = finite(read.fundingRatePct) && read.fundingRatePct! < 0 && finite(read.longShortRatio) && read.longShortRatio! <= 0.67 && read.longShortRatio! > 0;
  const conflict = crowdedLong && chartDirection === "BEARISH" ? "Long-side crowding conflicts with Bullseye's bearish chart read. That tension increases trap risk; neither input proves the next move."
    : crowdedShort && chartDirection === "BULLISH" ? "Short-side crowding conflicts with Bullseye's bullish chart read. That tension increases trap risk; neither input proves the next move."
    : crowdedLong ? "Positive funding and a long-heavy ratio suggest long-side crowding. The chart read does not verify a squeeze or continuation."
    : crowdedShort ? "Negative funding and a short-heavy ratio suggest short-side crowding. The chart read does not verify a squeeze or continuation."
    : "The visible metrics do not jointly verify one-sided crowding or a conflict with price structure.";
  return { status: overlap.length ? "VERIFIED" : "LIMITED", pair: expected, observations, overlap, conflict,
    caution: "Funding intervals and liquidation units differ by platform. Heatmap clusters are estimates; traded liquidations describe the past. Neither predicts a forced move or trade direction." };
}
