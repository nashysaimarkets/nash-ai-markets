import type { Metadata } from "next";
import { MemberEmptyCanvas } from "../components/MemberEmptyCanvas.tsx";
import { requireMemberPage } from "../lib/server/member-page-access.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Historical Archive | NASH AI Markets",
  description: "Browse stored Bullseye analysis snapshots by session date.",
  robots: { index: false, follow: false },
};

export default async function ArchivePage() {
  await requireMemberPage();
  return <MemberEmptyCanvas active="archive" />;
}
