import { notFound } from "next/navigation";
import { DashboardCandlestickChart } from "../../dashboard/components/DashboardCandlestickChart";
import { getConfiguredFmpCandles } from "../../lib/providers/financial-modeling-prep-candles";

export const dynamic = "force-dynamic";

/** Non-production layout harness for the verified candlestick workspace. */
export default async function TerminalChartFixturePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const series = await getConfiguredFmpCandles("5m");
  return <main className="foxtrotTerminal customerTerminal" style={{ padding: "24px" }}>
    <p className="ctEyebrow">DEV · LAYOUT FIXTURE · NOT LIVE MARKET DATA</p>
    <h1 style={{ fontSize: "42px", margin: "12px 0 24px" }}>Terminal chart fixture</h1>
    <section className="ctChartPrimary"><DashboardCandlestickChart series={series} /></section>
  </main>;
}
