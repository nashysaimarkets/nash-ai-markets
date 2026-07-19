import { MemberShell } from "../components/MemberShell.tsx";
import { BrandLoader } from "../components/BrandLoader.tsx";

export default function DashboardLoading() {
  return <MemberShell active="dashboard" className="dashboardLoading">
    <div className="memberDashboardShell" aria-busy="true" aria-live="polite">
      <BrandLoader label="Loading member dashboard" />
      <section className="memberWelcome"><div><span className="terminalSkeletonLine" style={{ width: 130 }} /><span className="terminalSkeletonLine" style={{ width: 320 }} /><span className="terminalSkeletonLine" style={{ width: 460 }} /></div></section>
      <section className="sessionPulse terminalSkeletonCard" aria-hidden="true"><div className="sessionPulseVisual" /><div className="sessionPulseBody"><header><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></header><div className="sessionPulseBand">{Array.from({ length: 6 }, (_, index) => <article key={index}><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></article>)}</div></div></section>
      <section className="executiveMorningBrief terminalSkeletonCard" aria-hidden="true"><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></section>
      <section className="dailyDashboardGrid" aria-hidden="true">{Array.from({ length: 3 }, (_, index) => <article className="dailyCard terminalSkeletonCard" key={index}><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></article>)}</section>
    </div>
  </MemberShell>;
}
