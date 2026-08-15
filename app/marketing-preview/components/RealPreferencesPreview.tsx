import Link from "next/link";
import { MemberShell } from "../../components/MemberShell.tsx";
import { PreviewPreferencesClient } from "./PreviewPreferencesClient.tsx";

export function RealPreferencesPreview() {
  return (
    <MemberShell active="onboarding" className="marketingRealMemberPreview">
      <aside className="dashPartialBanner" role="status">
        <strong>EXAMPLE-ONLY MEMBER EXPERIENCE</strong>
        <span>Workspace choices on this private preview are temporary and are not saved.</span>
      </aside>
      <div className="onboardingPage preferencesPage">
        <span>PREFERENCES · EXAMPLE</span>
        <h1>Personal workspace</h1>
        <p>
          Local display choices for Dashboard layout. Account onboarding preferences remain on the workspace setup
          page. Essential disclosures and session status stay visible.
        </p>
        <PreviewPreferencesClient />
        <p className="oracleWorkspaceNote">
          <Link href="/onboarding">Open account workspace preferences</Link>
          {" · "}
          <Link href="/marketing-preview">Return to Dashboard</Link>
        </p>
      </div>
    </MemberShell>
  );
}
