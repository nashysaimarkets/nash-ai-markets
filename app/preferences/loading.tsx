import { BrandLoader } from "../components/BrandLoader.tsx";
import { MemberEmptyCanvas } from "../components/MemberEmptyCanvas.tsx";

export default function PreferencesLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <BrandLoader label="Loading preferences" />
      <MemberEmptyCanvas active="onboarding" className="onboardingPage preferencesPage" />
    </div>
  );
}
