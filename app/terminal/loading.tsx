export default function TerminalLoading() {
  return (
    <main className="memberDashboard customerTerminal premiumTerminal terminalLoading terminalMemberPage tradingDeskPage" aria-busy="true" aria-live="polite" aria-label="Loading Trading Desk">
      <div className="memberDashboardShell ctWorkspace deskWorkspaceShell">
        <section className="deskHero" aria-hidden="true">
          <span className="terminalSkeletonLine" style={{ width: 180, height: 14 }} />
          <span className="terminalSkeletonLine" style={{ width: 320, height: 48, marginTop: 16 }} />
          <span className="terminalSkeletonLine" style={{ width: 420, height: 18, marginTop: 14 }} />
        </section>
      </div>
    </main>
  );
}
