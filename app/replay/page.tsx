import type { Metadata } from "next";
import { MemberEmptyCanvas } from "../components/MemberEmptyCanvas.tsx";
import { requireMemberPage } from "../lib/server/member-page-access.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Bullseye Replay Beta | NASH AI Markets",
  description: "Beta replay of stored Bullseye session plans without invented candle playback.",
  robots: { index: false, follow: false },
};

export default async function ReplayPage() {
  await requireMemberPage();
  return <MemberEmptyCanvas active="replay" className="replayPage" />;
}
