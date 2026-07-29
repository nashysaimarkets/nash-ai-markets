export function journalPerformance(rows: Array<{
  pnl: number | null;
  direction: string;
  instrument_class: string;
  followed_plan: boolean | null;
  traded_at: string;
  vix_regime: string | null;
  bullseye_score: number | null;
}>) {
  const closed = rows.filter((row) => typeof row.pnl === "number" && Number.isFinite(row.pnl));
  if (closed.length < 5) {
    return {
      sufficient: false as const,
      sampleSize: closed.length,
      message: "Insufficient sample — at least 5 closed trades with P&L are required before percentages are shown.",
    };
  }
  const wins = closed.filter((row) => (row.pnl as number) > 0);
  const losses = closed.filter((row) => (row.pnl as number) < 0);
  const grossWin = wins.reduce((sum, row) => sum + (row.pnl as number), 0);
  const grossLoss = Math.abs(losses.reduce((sum, row) => sum + (row.pnl as number), 0));
  return {
    sufficient: true as const,
    sampleSize: closed.length,
    winRate: wins.length / closed.length,
    averageWin: wins.length ? grossWin / wins.length : 0,
    averageLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    longCount: closed.filter((row) => row.direction === "long").length,
    shortCount: closed.filter((row) => row.direction === "short").length,
    futuresCount: closed.filter((row) => row.instrument_class === "futures").length,
    optionsCount: closed.filter((row) => row.instrument_class === "options").length,
    planFollowed: closed.filter((row) => row.followed_plan === true).length,
    planBroken: closed.filter((row) => row.followed_plan === false).length,
  };
}
