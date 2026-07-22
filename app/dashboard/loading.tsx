import { MemberShell } from "../components/MemberShell.tsx";
import { BrandLoader } from "../components/BrandLoader.tsx";

export default function DashboardLoading() {
  return (
    <MemberShell active="dashboard" className="dashboardLoading">
      <div className="memberDashboardShell eliteDashboard eliteDashboardLoading dashCompact" aria-busy="true" aria-live="polite">
        <BrandLoader label="Preparing dashboard" />
        <p className="eliteLoadingStatus">Verifying market context…</p>
        <section className="dashStatusCard terminalSkeletonCard" aria-hidden="true">
          <span className="terminalSkeletonLine skeletonShort" />
          <span className="terminalSkeletonLine skeletonTitle" />
          <span className="terminalSkeletonLine skeletonCopy" />
          <div className="eliteLoadingMeta">{Array.from({ length: 6 }, (_, index) => <span className="terminalSkeletonLine" key={index} />)}</div>
        </section>
        <section className="dashboardMarketChart terminalSkeletonCard dashboardChartSkeleton" aria-hidden="true">
          <span className="terminalSkeletonLine skeletonShort" />
          <span className="terminalSkeletonLine skeletonTitle" />
          <div className="dashboardChartSkeletonCanvas" />
        </section>
        <section className="dashPlanCard terminalSkeletonCard" aria-hidden="true">
          <span className="terminalSkeletonLine skeletonShort" />
          <span className="terminalSkeletonLine skeletonTitle" />
          <div>{Array.from({ length: 3 }, (_, index) => <span className="terminalSkeletonLine" key={index} />)}</div>
        </section>
        <section className="dashReviewCard terminalSkeletonCard" aria-hidden="true">
          <span className="terminalSkeletonLine skeletonShort" />
          <span className="terminalSkeletonLine skeletonTitle" />
          <div>{Array.from({ length: 3 }, (_, index) => <span className="terminalSkeletonLine" key={index} />)}</div>
        </section>
      </div>
    </MemberShell>
  );
}
