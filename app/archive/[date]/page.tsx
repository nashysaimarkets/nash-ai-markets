import type { Metadata } from "next";
import { MemberEmptyCanvas } from "../../components/MemberEmptyCanvas.tsx";
import { requireMemberPage } from "../../lib/server/member-page-access.ts";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  return {
    title: `Archive ${date} | NASH AI Markets`,
    description: `Stored Bullseye analysis snapshot for session ${date}.`,
    robots: { index: false, follow: false },
  };
}

export default async function ArchiveDatePage() {
  await requireMemberPage();
  return <MemberEmptyCanvas active="archive" />;
}
