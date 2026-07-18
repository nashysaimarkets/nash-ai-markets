import { BrandLoader } from "../../components/BrandLoader.tsx";
import { BrandLogo } from "../../components/BrandLogo.tsx";

export default function Founding100AdminLoading() {
  return <main className="foundingAdminPage dashboardLoading" aria-busy="true" aria-live="polite"><BrandLoader label="Loading Founding 100 operations" /><header><BrandLogo audience="member" context="bullseye" /><div><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></div></header><section className="foundingAdminSummary" aria-hidden="true">{Array.from({ length: 3 }, (_, index) => <article className="terminalSkeletonCard" key={index}><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></article>)}</section><section className="foundingAdminTable terminalSkeletonCard" aria-hidden="true"><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></section></main>;
}
