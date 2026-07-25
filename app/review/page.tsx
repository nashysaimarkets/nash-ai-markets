import type { Metadata } from "next";
import { MemberEmptyCanvas } from "../components/MemberEmptyCanvas.tsx";
import { requireMemberPage } from "../lib/server/member-page-access.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Yesterday's Review | NASH AI Markets",
  description: "Accountable review of the previous session from stored Bullseye snapshots only.",
  robots: { index: false, follow: false },
};

export default async function YesterdayReviewPage() {
  await requireMemberPage();
  return <MemberEmptyCanvas active="review" className="reviewPage" />;
}
