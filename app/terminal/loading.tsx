function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <span className="terminalSkeletonLine" style={{ width }} />;
}

function SkeletonCard({ className = "" }: { className?: string }) {
  return <section className={`ftCard terminalSkeletonCard ${className}`}><div><SkeletonLine width="38%" /><SkeletonLine width="64%" /></div><SkeletonLine width="88%" /><SkeletonLine /><SkeletonLine width="72%" /></section>;
}

export default function TerminalLoading() {
  return <main className="foxtrotTerminal terminalLoading" aria-busy="true" aria-live="polite" aria-label="Loading Bullseye terminal">
    <header className="ftTopbar terminalLoadingTopbar"><SkeletonLine width="190px" /><SkeletonLine width="280px" /><SkeletonLine width="120px" /></header>
    <aside className="ftRail terminalLoadingRail" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <SkeletonLine key={index} width="28px" />)}</aside>
    <section className="ftWorkspace">
      <div className="ftSafetyBanner"><SkeletonLine width="58%" /></div>
      <section className="ftEngineStrip" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <article key={index}><SkeletonLine width="70%" /><SkeletonLine width="84%" /></article>)}</section>
      <section className="ftQuoteStrip" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <article key={index}><SkeletonLine width="65%" /><SkeletonLine width="82%" /></article>)}</section>
      <section className="ftPrimaryGrid" aria-hidden="true"><section className="marketChart terminalSkeletonChart"><div className="marketChartHeader"><SkeletonLine width="180px" /><SkeletonLine width="220px" /></div><div><SkeletonLine width="72%" /><SkeletonLine width="88%" /><SkeletonLine width="58%" /></div></section><div className="ftDecisionStack"><SkeletonCard /><SkeletonCard /></div></section>
      <section className="ftAnalysisGrid" aria-hidden="true"><SkeletonCard /><SkeletonCard /></section>
    </section>
  </main>;
}
