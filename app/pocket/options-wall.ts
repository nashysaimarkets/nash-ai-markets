export type OptionsWallRow = { side: "CALL" | "PUT"; strike: number; volume: number; expiry: string };
export type OptionsWallRead = { symbol: string; readable: boolean; rows: OptionsWallRow[]; limitation: string };
export type OptionsWallMatch = OptionsWallRow & { level: { kind: string; price: number; label: string } };
export type OptionsWallResult = { status: "MATCHED" | "NO_OVERLAP" | "UNVERIFIED"; message: string; symbol: string; rows: OptionsWallRow[]; matches: OptionsWallMatch[] };

export function explicitOptionsSymbol(ticker: string, instrument: string): string {
  if (ticker.trim() && ticker !== "UNKNOWN") return ticker.trim().toUpperCase();
  // These are exact listed index/ETF/futures labels. A spread bet or generic
  // S&P chart is not silently treated as the same underlying.
  return /^(SPX|ES|SPY)(?=$|[\s:.-])/.exec(instrument.trim().toUpperCase())?.[1] ?? "UNKNOWN";
}

export function crossCheckOptionsWall(read: OptionsWallRead, expectedTicker: string, levels: { kind: string; price: string; label: string }[]): OptionsWallResult {
  const empty = (message: string): OptionsWallResult => ({ status: "UNVERIFIED", message, symbol: read.symbol, rows: [], matches: [] });
  // An unknown or mismatched underlying is never allowed to annotate the chart.
  const symbol = (value: string) => value.trim().toUpperCase().replace(/^[A-Z]+:/, "");
  if (!read.readable || !read.rows.length) return empty(read.limitation || "The strike and volume labels are not readable enough to compare.");
  if (!expectedTicker || expectedTicker === "UNKNOWN" || !read.symbol || symbol(read.symbol) !== symbol(expectedTicker)) {
    return empty("The options profile and chart cannot be confirmed as the same listed symbol.");
  }
  const verifiedLevels = levels.flatMap((level) => {
    const price = Number(level.price.replaceAll(",", ""));
    return ["support", "resistance", "pivot"].includes(level.kind) && level.price.trim() && Number.isFinite(price) && price > 0
      ? [{ kind: level.kind, price, label: level.label.slice(0, 50) }] : [];
  });
  if (!verifiedLevels.length) return empty("The price chart has no verified numeric structural level for this comparison.");
  const rows = read.rows.filter((row) => (row.side === "CALL" || row.side === "PUT") && Number.isFinite(row.strike) && row.strike > 0 && Number.isFinite(row.volume) && row.volume > 0 && row.expiry.trim()).slice(0, 8);
  if (!rows.length) return empty("A readable strike, expiry and traded-volume value are required.");
  const matches = rows.flatMap((row) => {
    // Relative tolerance handles plotted rounding; the absolute cap prevents a distant strike from being called nearby.
    const level = verifiedLevels.find((candidate) => Math.abs(candidate.price - row.strike) <= Math.min(candidate.price * 0.005, 5));
    return level ? [{ ...row, level }] : [];
  });
  return {
    status: matches.length ? "MATCHED" : "NO_OVERLAP",
    message: matches.length ? "Visible options volume overlaps a verified chart level. This is context, not a directional signal." : "No visible high-volume strike overlaps a verified chart level.",
    symbol: symbol(read.symbol), rows, matches,
  };
}
