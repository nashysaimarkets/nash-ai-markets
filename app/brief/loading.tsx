import { BrandLoader } from "../components/BrandLoader.tsx";
import { MemberEmptyCanvas } from "../components/MemberEmptyCanvas.tsx";

export default function MarketBriefLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <BrandLoader label="Loading market brief" />
      <MemberEmptyCanvas active="brief" className="marketBriefPage dashboardLoading" />
    </div>
  );
}
