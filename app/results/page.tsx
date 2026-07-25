import type { Metadata } from "next";
import { MemberEmptyCanvas } from "../components/MemberEmptyCanvas.tsx";
import { requireMemberPage } from "../lib/server/member-page-access.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Results Centre | NASH AI Markets",
  description: "Foundation aggregates from stored market analysis snapshots — no fabricated accuracy.",
  robots: { index: false, follow: false },
};

export default async function ResultsCentrePage() {
  await requireMemberPage();
  return <MemberEmptyCanvas active="results" className="resultsPage" />;
}
