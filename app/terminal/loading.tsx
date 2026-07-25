import { BrandLoader } from "../components/BrandLoader.tsx";

export default function TerminalLoading() {
  return (
    <main className="memberDashboard customerTerminal terminalLoading terminalMemberPage terminalCanvasPage" aria-busy="true" aria-live="polite" aria-label="Loading Terminal">
      <BrandLoader label="Loading Terminal" />
      <header className="memberDashboardNav"><span className="terminalSkeletonLine" style={{ width: 190 }} /><span className="terminalSkeletonLine" style={{ width: 420 }} /></header>
      <section className="memberDashboardShell ctWorkspace terminalMarketsCanvas" aria-hidden="true">
        <div className="terminalCanvasHeader">
          <span className="terminalSkeletonLine terminalCanvasLogoSkeleton" style={{ width: 360, height: 64 }} />
        </div>
        <div className="tmMarketsLayout">
          <aside className="tmMarketsSidebar">
            <span className="terminalSkeletonLine" style={{ width: "70%", height: 20, margin: 16 }} />
            <span className="terminalSkeletonLine" style={{ width: "55%", height: 16, margin: "8px 16px" }} />
            <span className="terminalSkeletonLine" style={{ width: "60%", height: 16, margin: "8px 16px" }} />
          </aside>
          <div className="tmMarketsPanel">
            <span className="terminalSkeletonLine" style={{ width: "40%", height: 24, margin: 32 }} />
            <span className="terminalSkeletonLine" style={{ width: "70%", height: 16, margin: "12px 32px" }} />
          </div>
        </div>
      </section>
    </main>
  );
}
