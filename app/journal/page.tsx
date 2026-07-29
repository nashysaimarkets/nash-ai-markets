import type { Metadata } from "next";
import { MemberEmptyCanvas } from "../components/MemberEmptyCanvas.tsx";
import { requireMemberPage } from "../lib/server/member-page-access.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trade Journal | NASH AI Markets",
  description: "Private trade journal for disciplined post-trade review.",
  robots: { index: false, follow: false },
};

export default async function JournalPage() {
  await requireMemberPage();
  return <MemberEmptyCanvas active="journal" className="journalPage" />;
}
