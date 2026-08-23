import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Join Pocket Bullseye",
  robots: { index: false, follow: false },
};

export default function JoinPocketBullseye() {
  redirect("/pocket/founding#founding");
}
