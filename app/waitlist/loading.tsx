import { BrandLoader } from "../components/BrandLoader.tsx";

export default function WaitlistLoading() {
  return <main className="launchPage dashboardLoading" aria-busy="true" aria-live="polite"><BrandLoader label="Loading launch access" /><header className="launchPageNav"><span className="terminalSkeletonLine" style={{ width: 220 }} /></header><section className="launchHero" aria-hidden="true"><div className="terminalSkeletonCard"><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></div><div className="launchFormCard terminalSkeletonCard"><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></div></section></main>;
}
