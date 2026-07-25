import type { Metadata } from "next";
import { MemberEmptyCanvas } from "../components/MemberEmptyCanvas.tsx";
import { requireMemberPage } from "../lib/server/member-page-access.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Journal Performance | NASH AI Markets",
  description: "Process analytics from your private trade journal once sample size is sufficient.",
  robots: { index: false, follow: false },
};

export default async function PerformancePage() {
  await requireMemberPage();
  return <MemberEmptyCanvas active="performance" className="resultsPage" />;
}
