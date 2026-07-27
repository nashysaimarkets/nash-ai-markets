import { BrandLoader } from "../components/BrandLoader.tsx";
import { MemberEmptyCanvas } from "../components/MemberEmptyCanvas.tsx";

export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <BrandLoader label="Preparing dashboard" />
      <MemberEmptyCanvas active="dashboard" className="dashboardLoading" />
    </div>
  );
}
