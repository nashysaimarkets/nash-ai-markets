import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberShell } from "../components/MemberShell.tsx";
import { createClient } from "../../utils/supabase/server.ts";
import { PreferencesClient } from "./PreferencesClient.tsx";

export const metadata: Metadata = {
  title: "Preferences | NASH AI Markets",
  description: "Personal workspace and display preferences for Nash AI Markets.",
  robots: { index: false, follow: false },
};

export default async function PreferencesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <MemberShell active="onboarding">
      <div className="onboardingPage preferencesPage">
        <span>PREFERENCES</span>
        <h1>Personal workspace</h1>
        <p>
          Local display choices for Dashboard layout. Account onboarding preferences remain on the workspace
          setup page. Essential disclosures and session status stay visible.
        </p>
        <PreferencesClient />
        <p className="oracleWorkspaceNote">
          <Link href="/onboarding">Open account workspace preferences</Link>
          {" · "}
          <Link href="/dashboard">Return to Dashboard</Link>
        </p>
      </div>
    </MemberShell>
  );
}
