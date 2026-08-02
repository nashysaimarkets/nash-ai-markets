export default function TerminalLoading() {
  return (
    <main
      className="memberDashboard customerTerminal premiumTerminal terminalLoading terminalMemberPage tradingDeskPage"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading Trading Desk"
      style={{ minHeight: "100vh", background: "#05070a", color: "#eef2f5" }}
    >
      <div className="memberDashboardShell ctWorkspace deskWorkspaceShell">
        <section className="deskHero" aria-hidden="true" style={{ background: "#0a100e", border: "1px solid #24322c", borderRadius: 18, padding: 36 }}>
          <p style={{ margin: 0, color: "#62e6b1", letterSpacing: "0.12em", fontSize: 12, fontWeight: 700 }}>LOADING</p>
          <p style={{ margin: "14px 0 0", fontSize: 28, fontWeight: 650, color: "#f4f3ec" }}>Trading Desk</p>
          <p style={{ margin: "10px 0 0", color: "#9aa7a0" }}>Preparing verified market workspace…</p>
          <span className="terminalSkeletonLine" style={{ display: "block", width: 180, height: 14, marginTop: 22, background: "#1a2420", borderRadius: 8 }} />
          <span className="terminalSkeletonLine" style={{ display: "block", width: 320, height: 18, marginTop: 14, background: "#1a2420", borderRadius: 8 }} />
        </section>
      </div>
    </main>
  );
}
