import { MemberShell } from "../components/MemberShell.tsx";

export default function FoundingMemberLoading() {
  return <MemberShell active="profile" className="foundingPage dashboardLoading"><div className="memberDashboardShell" aria-busy="true" aria-live="polite"><section className="foundingHero"><div><span className="terminalSkeletonLine" style={{ width: 150 }} /><span className="terminalSkeletonLine" style={{ width: 380 }} /><span className="terminalSkeletonLine" style={{ width: 540 }} /></div></section><section className="foundingGrid" aria-hidden="true">{Array.from({ length: 2 }, (_, index) => <article className="dailyCard terminalSkeletonCard" key={index}><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></article>)}</section></div></MemberShell>;
}
