import { notFound } from "next/navigation";
import { MarketChart } from "../components/MarketChart";
import { TERMINAL_CHART_TEST_FIXTURE } from "./fixture";

export const metadata = { title: "Terminal Chart Test", robots: { index: false, follow: false } };

export default async function TerminalChartTestPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV === "production" || process.env.BULLSEYE_CHART_TEST !== "1") notFound();
  const offline = (await searchParams).view === "offline";

  return (
    <main className="foxtrotTerminal terminalChartTestPage">
      <section className="ftWorkspace">
        <div className="terminalChartTestBanner" role="status">
          <strong>{offline ? "OFFLINE-STATE VISUAL TEST" : "DEMO / TEST DATA"}</strong>
          <span>{offline ? "Production-safe empty state. No market-session status or countdown is inferred." : "Deterministic fixture for visual verification only. Never live, delayed, or tradeable market data."}</span>
        </div>
        <MarketChart key={offline ? "offline" : "fixture"} data={offline ? [] : [...TERMINAL_CHART_TEST_FIXTURE]} symbol="ES" mode="test" />
      </section>
    </main>
  );
}
