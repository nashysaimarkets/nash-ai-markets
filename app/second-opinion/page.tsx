import type { Metadata } from "next";
import { headers } from "next/headers";
import { MemberShell } from "../components/MemberShell.tsx";
import { requireMemberPage } from "../lib/server/member-page-access.ts";
import { isOwnerOnlyStagingRequest } from "../lib/server/staging-owner-preview.ts";
import { SecondOpinionWorkbench } from "./SecondOpinionWorkbench.tsx";
import "./second-opinion.css";
import "./auto-read.css";
import "./zing.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trading Second Opinion",
  description: "Private, process-first chart review and pre-trade risk check.",
  robots: { index: false, follow: false },
};

export default async function SecondOpinionPage() {
  const requestHeaders = await headers();
  if (isOwnerOnlyStagingRequest(requestHeaders)) {
    return (
      <MemberShell active="second-opinion" className="secondOpinionPage">
        <SecondOpinionWorkbench canSaveToJournal={false} />
      </MemberShell>
    );
  }
  const { access } = await requireMemberPage();

  return (
    <MemberShell active="second-opinion" className="secondOpinionPage">
      <SecondOpinionWorkbench canSaveToJournal={access.features.journal} />
    </MemberShell>
  );
}
