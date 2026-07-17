import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server.ts";
import { MemberShell } from "../components/MemberShell.tsx";
import { OnboardingForm } from "./OnboardingForm.tsx";

export const metadata: Metadata = { title: "Welcome Setup", robots: { index: false, follow: false } };
export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <MemberShell active="onboarding"><div className="onboardingPage"><span>WELCOME TO NASH AI MARKETS</span><h1>Set up your market workspace.</h1><p>Three short choices help us present the product clearly. You can update them later.</p><OnboardingForm /></div></MemberShell>;
}
