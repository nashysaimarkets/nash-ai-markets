import { TERMINAL_SKELETON_PANELS } from "./lib/terminal-state.ts";

function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <span className="terminalSkeletonLine" style={{ width }} />;
}

export default function TerminalLoading() {
  return (
    <main className="missionControl terminalLoading" aria-busy="true" aria-label="Loading market terminal">
      <aside className="mcSidebar terminalSkeletonSidebar">
        <SkeletonLine width="72%" />
        <div className="terminalSkeletonNav">
          <SkeletonLine /><SkeletonLine width="84%" /><SkeletonLine width="91%" /><SkeletonLine width="76%" />
        </div>
      </aside>
      <section className="mcMain">
        <header className="mcHeader terminalSkeletonHeader">
          <div><SkeletonLine width="120px" /><SkeletonLine width="320px" /><SkeletonLine width="240px" /></div>
          <SkeletonLine width="130px" />
        </header>
        <div className="mcPreviewNotice"><SkeletonLine width="58%" /></div>
        <section className="mcKpiStrip terminalSkeletonMetrics" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => <div key={index}><SkeletonLine width="45%" /><SkeletonLine width="70%" /><SkeletonLine width="55%" /></div>)}
        </section>
        <section className="terminalDashboardGrid" aria-hidden="true">
          {TERMINAL_SKELETON_PANELS.map((panel) => (
            <section className={`terminalPanel terminalSkeletonPanel ${panel.className}`} key={panel.key}>
              <div className="terminalPanelHead"><div><SkeletonLine width="90px" /><SkeletonLine width="170px" /></div><SkeletonLine width="64px" /></div>
              <SkeletonLine width="78%" /><SkeletonLine /><SkeletonLine width="62%" />
            </section>
          ))}
        </section>
      </section>
    </main>
  );
}
