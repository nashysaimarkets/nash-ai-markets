import { BrandLoader } from "../components/BrandLoader.tsx";

export default function TerminalLoading() {
  return (
    <main className="memberDashboard customerTerminal terminalLoading terminalMemberPage terminalCanvasPage" aria-busy="true" aria-live="polite" aria-label="Loading Terminal">
      <BrandLoader label="Loading Terminal" />
      <header className="memberDashboardNav"><span className="terminalSkeletonLine" style={{ width: 190 }} /><span className="terminalSkeletonLine" style={{ width: 420 }} /></header>
      <section className="memberDashboardShell ctWorkspace terminalEmptyCanvas" aria-hidden="true">
        <span className="terminalSkeletonLine terminalCanvasLogoSkeleton" style={{ width: 360, height: 64 }} />
      </section>
    </main>
  );
}
