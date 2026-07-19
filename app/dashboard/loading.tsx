import { MemberShell } from "../components/MemberShell.tsx";
import { BrandLoader } from "../components/BrandLoader.tsx";

export default function DashboardLoading() {
  return <MemberShell active="dashboard" className="dashboardLoading">
    <div className="memberDashboardShell eliteDashboard eliteDashboardLoading" aria-busy="true" aria-live="polite">
      <BrandLoader label="Preparing Bullseye command view" />
      <section className="eliteCommandHeader terminalSkeletonCard"><div><span className="terminalSkeletonLine" style={{ width: 150 }} /><span className="terminalSkeletonLine" style={{ width: 360 }} /><span className="terminalSkeletonLine" style={{ width: 480 }} /></div></section>
      <section className="eliteStatusDeck executiveKpiStrip" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <article className="eliteMetricCard terminalSkeletonCard" key={index}><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></article>)}</section>
      <section className="executiveMorningBrief terminalSkeletonCard" aria-hidden="true"><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></section>
      <section className="eliteStructurePanel terminalSkeletonCard" aria-hidden="true"><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></section>
      <section className="eliteScenarioGrid" aria-hidden="true">{Array.from({ length: 2 }, (_, index) => <article className="eliteScenario terminalSkeletonCard" key={index}><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></article>)}</section>
    </div>
  </MemberShell>;
}
