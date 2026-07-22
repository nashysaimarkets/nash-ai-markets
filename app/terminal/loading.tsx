import { BrandLoader } from "../components/BrandLoader.tsx";

function Line({ width = "100%" }: { width?: string }) {
  return <span className="terminalSkeletonLine" style={{ width }} />;
}

function Panel({ rows = 3 }: { rows?: number }) {
  return <section className="ctPanel terminalSkeletonCard"><div><Line width="32%" /><Line width="58%" /></div>{Array.from({ length: rows }, (_, index) => <Line key={index} width={`${92 - index * 12}%`} />)}</section>;
}

export default function TerminalLoading() {
  return <main className="memberDashboard customerTerminal terminalLoading terminalMemberPage" aria-busy="true" aria-live="polite" aria-label="Loading Terminal">
    <BrandLoader label="Loading verified market intelligence" />
    <header className="memberDashboardNav"><Line width="190px" /><Line width="420px" /></header>
    <div className="memberToolbar ctTopbar ctToolbar"><Line width="120px" /></div>
    <section className="memberDashboardShell ctWorkspace" aria-hidden="true">
      <section className="ctHero"><div><Line width="36%" /><Line width="70%" /><Line width="88%" /></div><div><Line /><Line /><Line /></div></section>
      <div className="ctStatus"><Line width="72%" /></div>
      <section className="ctChartPrimary ctPanel terminalSkeletonCard" aria-label="Loading primary chart"><Line width="42%" /><Line width="68%" /><div className="dashboardChartSkeletonCanvas" style={{ height: 360, marginTop: 18 }} /><Line width="55%" /></section>
      <Panel rows={4} />
      <section className="ctPanel"><div className="ctAssetGrid">{Array.from({ length: 5 }, (_, index) => <article key={index}><Line width="54%" /><Line width="76%" /><Line width="88%" /></article>)}</div></section>
      <section className="ctTwoColumn"><Panel rows={4} /><Panel rows={4} /></section>
    </section>
  </main>;
}
