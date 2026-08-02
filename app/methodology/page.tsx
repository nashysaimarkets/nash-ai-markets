import type { Metadata } from "next";
import { MemberEmptyCanvas } from "../components/MemberEmptyCanvas.tsx";
import { requireMemberPage } from "../lib/server/member-page-access.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Bullseye Methodology | NASH AI Markets",
  description: "How Bullseye scores, no-trade rules, archive and results work — including hard limits.",
  robots: { index: false, follow: false },
};

export default async function MethodologyPage() {
  await requireMemberPage();
  return <MemberEmptyCanvas active="methodology" className="methodologyPage" />;
}
