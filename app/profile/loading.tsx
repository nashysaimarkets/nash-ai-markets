import { MemberShell } from "../components/MemberShell.tsx";
import { BrandLoader } from "../components/BrandLoader.tsx";

export default function ProfileLoading() {
  return <MemberShell active="profile" className="profilePage dashboardLoading">
    <div className="memberDashboardShell" aria-busy="true" aria-live="polite">
      <BrandLoader label="Loading member profile" />
      <section className="profileHero"><div><span className="terminalSkeletonLine" style={{ width: 140 }} /><span className="terminalSkeletonLine" style={{ width: 300 }} /><span className="terminalSkeletonLine" style={{ width: 480 }} /></div></section>
      <section className="profileGrid" aria-hidden="true">{Array.from({ length: 3 }, (_, index) => <article className="dailyCard terminalSkeletonCard" key={index}><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></article>)}</section>
    </div>
  </MemberShell>;
}
