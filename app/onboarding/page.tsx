import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { MemberShell } from "../components/MemberShell.tsx";
import { normalizeOnboardingPreferences } from "../lib/onboarding.ts";
import { OnboardingForm } from "./OnboardingForm.tsx";

export const metadata: Metadata = {
  title: "Workspace Preferences | NASH AI Markets",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase
    .from("member_onboarding")
    .select("experience, interests, notifications, completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const initialPreferences = normalizeOnboardingPreferences(data);
  const updating = Boolean(data?.completed_at && initialPreferences);
  return (
    <MemberShell active="onboarding">
      <div className="onboardingPage preferencesPage">
        <span>{updating ? "WORKSPACE PREFERENCES" : "WELCOME TO NASH AI MARKETS"}</span>
        <h1>{updating ? "Refine your market workspace." : "Set up your market workspace."}</h1>
        <p>
          {updating
            ? "Review and update how your member workspace is presented. Your current choices are shown below."
            : "Three short choices help us present the product clearly. You can update them later from Preferences."}
        </p>
        <OnboardingForm initialPreferences={initialPreferences} updating={updating} />
      </div>
    </MemberShell>
  );
}
