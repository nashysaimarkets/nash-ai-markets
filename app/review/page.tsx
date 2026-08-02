import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Yesterday's Review | NASH AI Markets",
  description: "Accountable review of the previous session from stored Bullseye snapshots only.",
  robots: { index: false, follow: false },
};

export default async function YesterdayReviewPage() {
  redirect("/reviews");
}
