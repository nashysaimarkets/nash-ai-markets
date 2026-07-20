import { MemberShell } from "../components/MemberShell.tsx";
import { BrandLoader } from "../components/BrandLoader.tsx";

export default function DashboardLoading() {
  return <MemberShell active="dashboard" className="dashboardLoading">
    <div className="memberDashboardShell eliteDashboard eliteDashboardLoading" aria-busy="true" aria-live="polite">
      <BrandLoader label="Preparing Bullseye command view" />
      <p className="eliteLoadingStatus">Verifying market context and preparing your command view…</p>
      <section className="eliteCommandHeader terminalSkeletonCard eliteLoadingHero" aria-hidden="true">
        <div><span className="terminalSkeletonLine skeletonShort" /><span className="terminalSkeletonLine skeletonTitle" /><span className="terminalSkeletonLine skeletonCopy" /></div>
        <div className="eliteLoadingMeta">{Array.from({ length: 3 }, (_, index) => <span className="terminalSkeletonLine" key={index} />)}</div>
        <div className="eliteLoadingActions"><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></div>
      </section>
      <section className="commandDataNotice terminalSkeletonCard eliteLoadingNotice" aria-hidden="true"><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></section>
      <section className="todaysEdge terminalSkeletonCard eliteLoadingEdge" aria-hidden="true"><span className="terminalSkeletonLine skeletonShort" /><span className="terminalSkeletonLine skeletonTitle" /><div>{Array.from({ length: 3 }, (_, index) => <span className="terminalSkeletonLine" key={index} />)}</div></section>
      <section className="liveMarketSummary terminalSkeletonCard dashboardChartSkeleton" aria-hidden="true"><span className="terminalSkeletonLine skeletonShort" /><span className="terminalSkeletonLine skeletonTitle" /><div>{Array.from({ length: 4 }, (_, index) => <span className="terminalSkeletonLine" key={index} />)}</div></section>
      <section className="dashboardMarketChart terminalSkeletonCard dashboardChartSkeleton" aria-hidden="true"><span className="terminalSkeletonLine skeletonShort" /><span className="terminalSkeletonLine skeletonTitle" /><div className="dashboardChartSkeletonCanvas" /></section>
      <section className="eliteStatusDeck executiveKpiStrip" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <article className="eliteMetricCard terminalSkeletonCard" key={index}><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></article>)}</section>
      <section className="todaysBullseyePlan terminalSkeletonCard eliteLoadingPlan" aria-hidden="true"><span className="terminalSkeletonLine skeletonShort" /><span className="terminalSkeletonLine skeletonTitle" /><div>{Array.from({ length: 4 }, (_, index) => <span className="terminalSkeletonLine" key={index} />)}</div></section>
      <section className="bullseyeMissionControl terminalSkeletonCard eliteLoadingMission" aria-hidden="true"><span className="terminalSkeletonLine skeletonShort" /><span className="terminalSkeletonLine skeletonTitle" /><div>{Array.from({ length: 3 }, (_, index) => <span className="terminalSkeletonLine" key={index} />)}</div></section>
      <section className="eliteStructurePanel terminalSkeletonCard" aria-hidden="true"><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></section>
      <section className="eliteScenarioGrid" aria-hidden="true">{Array.from({ length: 3 }, (_, index) => <article className="eliteScenario terminalSkeletonCard" key={index}><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></article>)}</section>
      <section className="marketCatalystBriefing terminalSkeletonCard eliteLoadingMission" aria-hidden="true"><span className="terminalSkeletonLine skeletonShort" /><span className="terminalSkeletonLine skeletonTitle" /><div>{Array.from({ length: 3 }, (_, index) => <span className="terminalSkeletonLine" key={index} />)}</div></section>
    </div>
  </MemberShell>;
}
