import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import { MemberEmptyCanvas } from "../components/MemberEmptyCanvas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Member Ideas",
  description: "Help shape the NASH AI Markets member experience.",
  robots: { index: false, follow: false },
};

export default async function IdeasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <MemberEmptyCanvas active="ideas" />;
}
