import { MemberShell } from "../components/MemberShell.tsx";
import { BrandLoader } from "../components/BrandLoader.tsx";

export default function MarketBriefLoading() {
  return <MemberShell active="brief" className="marketBriefPage dashboardLoading">
    <div className="memberDashboardShell" aria-busy="true" aria-live="polite">
      <BrandLoader label="Loading market brief" />
      <section className="briefHero"><div><span className="terminalSkeletonLine" style={{ width: 170 }} /><span className="terminalSkeletonLine" style={{ width: 320 }} /><span className="terminalSkeletonLine" style={{ width: 520 }} /></div></section>
      <section className="briefGrid" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <article className="dailyCard terminalSkeletonCard" key={index}><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></article>)}</section>
    </div>
  </MemberShell>;
}
